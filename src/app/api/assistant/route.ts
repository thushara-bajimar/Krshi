import { z } from "zod";
import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { getFarmContext } from "@/lib/authz";
import { unauthorized } from "@/lib/errors";
import { parseCommand, type ParseContext } from "@/lib/assistant/parse";
import { aiConfigured, aiParse } from "@/server/assistant/ai";
import { answer } from "@/server/assistant/answer";
import { todayISO } from "@/lib/format";

export const POST = authed(async (req) => {
  const { text } = z.object({ text: z.string().trim().min(1, "Say or type something").max(500) }).parse(await readJson(req));
  const ctx = await getFarmContext();
  if (!ctx) throw unauthorized();
  const [plots, workers, crops] = await Promise.all([
    ctx.farm ? prisma.plot.findMany({ where: { farmId: ctx.farm.id, status: { not: "ARCHIVED" } }, include: { crop: true }, orderBy: { name: "asc" } }) : [],
    ctx.farm ? prisma.worker.findMany({ where: { farmId: ctx.farm.id, active: true } }) : [],
    prisma.crop.findMany(),
  ]);
  const pctx: ParseContext = {
    today: todayISO(),
    plots: plots.map((p) => ({ id: p.id, name: p.name, cropKey: p.crop?.key ?? null })),
    workers: workers.map((w) => ({ id: w.id, name: w.name })),
    crops: crops.map((c) => ({ id: c.id, key: c.key, name: c.name, nameKn: c.nameKn })),
  };
  const ai = await aiParse(text, pctx);
  const parsed = ai ?? parseCommand(text, pctx);
  const reply = await answer(parsed, ctx);
  return json({ ...reply, parser: ai ? "ai" : "rules", aiAvailable: aiConfigured() });
}, { limit: 20, windowMs: 60_000 });
