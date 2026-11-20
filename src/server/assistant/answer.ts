import "server-only";
import { prisma } from "@/lib/db";
import type { Parsed, Period } from "@/lib/assistant/parse";
import type { PageContext } from "@/server/context";
import { loadFinance, pendingWages } from "@/server/finance";
import { getWeather, resolveLocation } from "@/integrations/weather/service";
import { describeWeather } from "@/integrations/weather/codes";
import { forecastAlerts } from "@/integrations/weather/advisory";
import { ACTIVITY_LABEL, EXPENSE_LABEL, TASK_LABEL, WORK_LABEL } from "@/lib/constants";
import { date as fmtDate, money, number, todayISO } from "@/lib/format";

export interface AssistantReply {
  intent: Parsed["intent"];
  text: string;
  items?: { title: string; detail?: string; href?: string }[];
  sources?: { label: string; url?: string; kind: "USER" | "LIVE" | "SAMPLE" | "CACHED" | "CURATED" }[];
  draft?: { entity: "activity" | "expense" | "labor" | "task"; defaults: Record<string, unknown>; summary: string[] };
  needsPermission?: boolean;
}

function range(p: Period) {
  const t = new Date(todayISO() + "T00:00:00Z");
  const y = t.getUTCFullYear(), m = t.getUTCMonth();
  switch (p) {
    case "today": return { from: t, to: t, label: "today" };
    case "yesterday": { const d = new Date(t.getTime() - 86400000); return { from: d, to: d, label: "yesterday" }; }
    case "week": return { from: new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400000), to: t, label: "this week" };
    case "last_month": return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 0)), label: "last month" };
    case "year": return { from: new Date(Date.UTC(m >= 3 ? y : y - 1, 3, 1)), to: t, label: "this financial year" };
    default: return { from: new Date(Date.UTC(y, m, 1)), to: t, label: "this month" };
  }
}

export async function answer(p: Parsed, ctx: PageContext): Promise<AssistantReply> {
  const farm = ctx.farm;
  const mine = { kind: "USER" as const, label: `Your records in KRSHI${farm ? ` · ${farm.name}` : ""}` };
  const needFarm = (): AssistantReply => ({ intent: p.intent, text: "Add a farm first — then I can record and look up your farm work." });
  const plotName = async (id?: string) => (id ? (await prisma.plot.findUnique({ where: { id } }))?.name : undefined);

  switch (p.intent) {
    case "record_activity": {
      if (!farm) return needFarm();
      if (!ctx.can("write")) return { intent: p.intent, text: "Your role on this farm cannot add records.", needsPermission: true };
      const a = p.activity;
      const d: Record<string, unknown> = { type: a.type, date: a.date, plotId: a.plotId ?? "", cropId: a.cropId ?? "", productName: a.productName ?? "", quantity: a.quantity != null ? String(a.quantity) : "", quantityUnit: a.quantityUnit ?? "", cost: a.cost != null ? String(a.cost) : "", description: a.description };
      return { intent: p.intent, text: "Please check these details and save.", draft: { entity: "activity", defaults: d, summary: [ACTIVITY_LABEL[a.type], fmtDate(a.date), (await plotName(a.plotId)) ?? "No plot chosen", a.productName, a.quantity != null ? `${a.quantity} ${a.quantityUnit ?? ""}` : null, a.cost != null ? money(a.cost) : null].filter(Boolean) as string[] } };
    }
    case "record_expense": {
      if (!farm) return needFarm();
      if (!ctx.can("finance:write")) return { intent: p.intent, text: "Your role on this farm cannot record expenses.", needsPermission: true };
      const e = p.expense;
      return { intent: p.intent, text: e.amount ? "Please check this expense and save." : "I could not hear an amount — please enter it.", draft: { entity: "expense", defaults: { amount: e.amount != null ? String(e.amount) : "", category: e.category, date: e.date, description: e.description, plotId: e.plotId ?? "" }, summary: [e.amount != null ? money(e.amount) : "Amount missing", EXPENSE_LABEL[e.category], fmtDate(e.date), e.description].filter(Boolean) as string[] } };
    }
    case "record_labor": {
      if (!farm) return needFarm();
      if (!ctx.can("finance:write")) return { intent: p.intent, text: "Your role on this farm cannot record wages.", needsPermission: true };
      const l = p.labor;
      const total = l.rate != null ? l.rate * l.units * l.workerCount : null;
      return {
        intent: p.intent,
        text: l.rate == null ? "I could not hear the wage rate — please enter it." : `That is ${l.workerCount} × ${number(l.units)} × ${money(l.rate)} = ${money(total)}. Please check and save.`,
        draft: { entity: "labor", defaults: { workerIds: l.workerIds, workerCount: String(l.workerCount), rate: l.rate != null ? String(l.rate) : "", units: String(l.units), wageType: l.wageType, taskCategory: l.taskCategory, date: l.date, plotId: l.plotId ?? "", amountPaid: l.amountPaid != null ? String(l.amountPaid) : "" }, summary: [`${l.workerCount} worker${l.workerCount > 1 ? "s" : ""}`, WORK_LABEL[l.taskCategory], fmtDate(l.date), total != null ? `Total ${money(total)}` : "Rate missing", l.amountPaid ? "Paid" : "Not marked paid"] },
      };
    }
    case "record_task": {
      if (!farm) return needFarm();
      if (!ctx.can("write")) return { intent: p.intent, text: "Your role on this farm cannot add tasks.", needsPermission: true };
      const t = p.task;
      return { intent: p.intent, text: "Please check this task and save.", draft: { entity: "task", defaults: { title: t.title, date: t.date, category: t.category, plotId: t.plotId ?? "", status: "PLANNED", workerIds: [] }, summary: [t.title, TASK_LABEL[t.category], fmtDate(t.date), (await plotName(t.plotId)) ?? ""].filter(Boolean) } };
    }
    case "query_spend": case "query_income": case "query_labor": {
      if (!farm) return needFarm();
      if (!ctx.can("finance:read")) return { intent: p.intent, text: "Your role on this farm does not include money records.", needsPermission: true };
      const r = range(p.period);
      const f = await loadFinance({ farmIds: [farm.id], from: r.from, to: r.to });
      if (p.intent === "query_labor") {
        const w = await pendingWages(farm.id);
        const byWorker = new Map<string, number>();
        for (const l of f.labor) byWorker.set(l.worker?.name ?? l.workerLabel ?? "Group", (byWorker.get(l.worker?.name ?? l.workerLabel ?? "Group") ?? 0) + Number(l.totalCost));
        return { intent: p.intent, text: `Labour ${r.label}: ${money(f.laborTotal)} across ${f.labor.length} work records. Pending wages (all time): ${money(w.total)}.`, items: [...byWorker.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ title: k, detail: money(v) })), sources: [mine] };
      }
      if (p.intent === "query_income") return { intent: p.intent, text: `Recorded income ${r.label}: ${money(f.summary.totalIncome)} net from ${f.incomes.length} sale${f.incomes.length === 1 ? "" : "s"}.`, items: Object.entries(f.incomeByCrop).map(([k, v]) => ({ title: k, detail: money(v) })), sources: [mine] };
      return {
        intent: p.intent,
        text: `You recorded ${money(f.summary.totalExpense)} spent ${r.label} (${fmtDate(r.from)} – ${fmtDate(r.to)}), including ${money(f.laborTotal)} labour.`,
        items: Object.entries(f.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ title: k === "LABOR" ? "Labour" : EXPENSE_LABEL[k] ?? k, detail: money(v) })),
        sources: [mine],
      };
    }
    case "query_activities": {
      if (!farm) return needFarm();
      const r = range(p.period);
      const acts = await prisma.activity.findMany({
        where: { farmId: farm.id, deletedAt: null, date: { gte: r.from, lte: r.to }, ...(p.plotId ? { plotId: p.plotId } : {}), ...(!p.plotId && p.cropKey ? { crop: { key: p.cropKey } } : {}) },
        include: { plot: true }, orderBy: { date: "desc" }, take: 12,
      });
      const where = (await plotName(p.plotId)) ?? (p.cropKey ? `${p.cropKey} plots` : "the farm");
      return {
        intent: p.intent,
        text: acts.length ? `${acts.length} activit${acts.length === 1 ? "y" : "ies"} recorded on ${where} ${r.label}:` : `Nothing recorded on ${where} ${r.label}.`,
        items: acts.map((a) => ({ title: `${ACTIVITY_LABEL[a.type]}${a.productName ? ` — ${a.productName}` : ""}`, detail: [fmtDate(a.date), a.plot?.name, a.quantity != null ? `${number(Number(a.quantity))} ${a.quantityUnit ?? ""}` : null].filter(Boolean).join(" · "), href: `/app/diary/${a.id}` })),
        sources: [mine],
      };
    }
    case "query_tasks": {
      if (!farm) return needFarm();
      const tasks = await prisma.task.findMany({ where: { farmId: farm.id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] } }, include: { plot: true }, orderBy: { date: "asc" }, take: 10 });
      return { intent: p.intent, text: tasks.length ? `You have ${tasks.length} open task${tasks.length === 1 ? "" : "s"}:` : "No open tasks.", items: tasks.map((t) => ({ title: t.title, detail: [fmtDate(t.date), t.plot?.name].filter(Boolean).join(" · "), href: "/app/calendar" })), sources: [mine] };
    }
    case "query_price": {
      const rows = await prisma.marketPrice.findMany({ where: { cropKey: p.cropKey }, orderBy: [{ priceDate: "desc" }], take: 60 });
      const live = rows.some((r) => r.dataKind !== "SAMPLE");
      const use = live ? rows.filter((r) => r.dataKind !== "SAMPLE") : rows;
      const latest = new Map<string, (typeof rows)[number]>();
      for (const r of use) if (!latest.has(r.market)) latest.set(r.market, r);
      const list = [...latest.values()].slice(0, 6);
      if (!list.length) return { intent: p.intent, text: `I have no ${p.cropKey} prices stored.` };
      return {
        intent: p.intent,
        text: `Latest reported ${p.cropKey} modal prices${live ? "" : " — SAMPLE DATA, not real prices"} (₹ per quintal):`,
        items: list.map((r) => ({ title: `${r.market} · ${r.variety || r.commodity}`, detail: `${money(Number(r.modalPrice), true)} on ${fmtDate(r.priceDate)}`, href: `/app/market?crop=${p.cropKey}` })),
        sources: [{ label: list[0].source, url: live ? list[0].sourceUrl : undefined, kind: live ? "LIVE" : "SAMPLE" }],
      };
    }
    case "query_weather": {
      const loc = resolveLocation(farm, ctx.user.district);
      const w = await getWeather(loc.lat, loc.lon, loc.label);
      if (!w) return { intent: p.intent, text: "Weather is unavailable right now." };
      const alerts = forecastAlerts(w.daily);
      return {
        intent: p.intent,
        text: `${loc.label}: ${Math.round(w.current.temperature)}°C, ${describeWeather(w.current.weatherCode)}. ${alerts.length ? `Warning: ${alerts[0].title} on ${fmtDate(alerts[0].date)}.` : ""}`,
        items: w.daily.slice(0, 5).map((d) => ({ title: fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" }), detail: `${describeWeather(d.weatherCode)} · ${Math.round(d.tempMax)}° · rain ${d.precipitationMm.toFixed(1)} mm${d.precipitationProbability != null ? ` (${d.precipitationProbability}%)` : ""}` })),
        sources: [{ label: `${w.provider} · fetched ${fmtDate(w.fetchedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`, url: w.providerUrl, kind: w.stale ? "CACHED" : "LIVE" }],
      };
    }
    case "query_scheme": {
      const k = p.keyword.trim();
      const schemes = await prisma.scheme.findMany({ where: k ? { OR: [{ name: { contains: k, mode: "insensitive" } }, { description: { contains: k, mode: "insensitive" } }, { crops: { has: k } }, { categories: { has: k } }] } : {}, take: 6 });
      const list = schemes.length ? schemes : await prisma.scheme.findMany({ take: 6, orderBy: { name: "asc" } });
      return { intent: p.intent, text: `${schemes.length ? "Schemes matching" : "I found no exact match; here are some"} ${k ? `“${k}”` : "schemes"}. Confirm details on the official portal:`, items: list.map((s) => ({ title: s.name, detail: s.benefits.slice(0, 110), href: `/app/schemes/${s.slug}` })), sources: [{ label: "KRSHI scheme directory (summaries, verify on official sites)", kind: "CURATED" }] };
    }
    default:
      return { intent: "unknown", text: "Sorry, I did not understand. Try: “I paid three workers 900 rupees each”, “Add an expense of 500 rupees for transport”, “How much did I spend this month?” or “What is the price of arecanut?”" };
  }
}
