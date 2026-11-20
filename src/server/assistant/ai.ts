import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Parsed, ParseContext, Period } from "@/lib/assistant/parse";
import { ACTIVITY_TYPES, EXPENSE_CATEGORIES, TASK_CATEGORIES, WORK_CATEGORIES } from "@/lib/validation/schemas";

// The model is used ONLY to turn a farmer's sentence into a structured request. It never writes records
// (the farmer confirms a pre-filled form) and never answers questions itself (answers come from the database).

const INTENTS = ["record_activity", "record_expense", "record_labor", "record_task", "query_spend", "query_labor", "query_income", "query_activities", "query_price", "query_tasks", "query_weather", "query_scheme", "unknown"] as const;
const PERIODS = ["today", "yesterday", "week", "month", "last_month", "year"] as const;

const Extraction = z.object({
  intent: z.enum(INTENTS),
  date: z.string().nullable().describe("YYYY-MM-DD the work happened / is planned; null if not said"),
  period: z.enum(PERIODS).nullable(),
  plotId: z.string().nullable().describe("id of a plot from the list, only if clearly referenced"),
  cropKey: z.string().nullable(),
  activityType: z.enum(ACTIVITY_TYPES).nullable(),
  productName: z.string().nullable(),
  quantity: z.number().nullable(),
  quantityUnit: z.string().nullable(),
  amount: z.number().nullable().describe("rupees for an expense, or activity cost"),
  expenseCategory: z.enum(EXPENSE_CATEGORIES).nullable(),
  workerCount: z.number().nullable(),
  workerIds: z.array(z.string()).describe("ids of workers from the list who were named"),
  ratePerWorker: z.number().nullable().describe("wage per worker per unit, in rupees"),
  units: z.number().nullable().describe("days / hours / tasks per worker"),
  wageType: z.enum(["DAILY", "HALF_DAY", "HOURLY", "TASK"]).nullable(),
  workCategory: z.enum(WORK_CATEGORIES).nullable(),
  paid: z.boolean().nullable().describe("true if the farmer says the wages were already paid"),
  taskTitle: z.string().nullable(),
  taskCategory: z.enum(TASK_CATEGORIES).nullable(),
  keyword: z.string().nullable(),
});

const SYSTEM = `You convert one message from a farmer in coastal Karnataka (English, Kannada or a mix; may come from speech recognition) into a structured request for the KRSHI farm app.
Rules:
- Only extract what the farmer actually said. Use null for anything not stated. Never invent quantities, prices, doses or dates.
- record_* intents are for things the farmer did or wants to record/plan. query_* intents are questions about their records, market prices, weather, schemes or upcoming tasks.
- plotId and workerIds must be ids from the provided lists, chosen only when the message clearly refers to them; otherwise null / [].
- "3 workers 900 rupees each" means workerCount 3, ratePerWorker 900. A total amount for a group should be divided per worker only if the farmer says it was the total.
- Dates: convert relative words (today, yesterday, ನಿನ್ನೆ, tomorrow, ನಾಳೆ) using the given today date.`;

let client: Anthropic | null = null;
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export async function aiParse(text: string, ctx: ParseContext): Promise<Parsed | null> {
  if (!aiConfigured()) return null;
  client ??= new Anthropic({ maxRetries: 2, timeout: 30_000 });
  const context = JSON.stringify({
    today: ctx.today,
    plots: ctx.plots.map((p) => ({ id: p.id, name: p.name, crop: p.cropKey })),
    workers: ctx.workers.map((w) => ({ id: w.id, name: w.name })),
    crops: ctx.crops.map((c) => c.key),
  });
  try {
    const res = await client.beta.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(Extraction) },
      messages: [{ role: "user", content: `Farm context: ${context}\n\nFarmer's message: ${text}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    return toParsed(res.parsed_output, ctx);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn("[assistant] rate limited; using rule parser");
    else if (e instanceof Anthropic.APIError) console.warn(`[assistant] API error ${e.status}; using rule parser`);
    else console.warn("[assistant] AI parse failed; using rule parser", (e as Error).message);
    return null;
  }
}

function toParsed(x: z.infer<typeof Extraction>, ctx: ParseContext): Parsed {
  // Never trust ids from model output: keep only ids that exist in this farm's context.
  const plotId = ctx.plots.some((p) => p.id === x.plotId) ? x.plotId! : undefined;
  const workerIds = x.workerIds.filter((id) => ctx.workers.some((w) => w.id === id));
  const date = x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : ctx.today;
  const period = (x.period ?? "month") as Period;
  const cropKey = ctx.crops.some((c) => c.key === x.cropKey) ? x.cropKey! : undefined;
  switch (x.intent) {
    case "record_activity":
      return { intent: "record_activity", activity: { type: x.activityType ?? "OTHER", date, plotId, cropId: cropKey ? ctx.crops.find((c) => c.key === cropKey)?.id : undefined, productName: x.productName ?? undefined, quantity: x.quantity ?? undefined, quantityUnit: x.quantityUnit ?? undefined, cost: x.amount ?? undefined, description: "" } };
    case "record_expense":
      return { intent: "record_expense", expense: { amount: x.amount ?? undefined, category: x.expenseCategory ?? "OTHER", date, description: x.productName ?? x.keyword ?? "", plotId } };
    case "record_labor": {
      const count = workerIds.length || Math.max(1, Math.round(x.workerCount ?? 1));
      const units = x.units ?? 1;
      return { intent: "record_labor", labor: { workerCount: count, workerIds, rate: x.ratePerWorker ?? undefined, units, wageType: x.wageType ?? "DAILY", taskCategory: x.workCategory ?? "other", date, plotId, amountPaid: x.paid && x.ratePerWorker != null ? Math.round(x.ratePerWorker * units * count * 100) / 100 : undefined } };
    }
    case "record_task":
      return { intent: "record_task", task: { title: x.taskTitle ?? "Farm task", date, category: x.taskCategory ?? "other", plotId } };
    case "query_price": return { intent: "query_price", cropKey: cropKey ?? "arecanut" };
    case "query_activities": return { intent: "query_activities", period, plotId, cropKey };
    case "query_scheme": return { intent: "query_scheme", keyword: x.keyword ?? cropKey ?? "" };
    case "query_spend": case "query_labor": case "query_income": return { intent: x.intent, period };
    case "query_tasks": case "query_weather": return { intent: x.intent };
    default: return { intent: "unknown" };
  }
}
