import "server-only";
import { prisma } from "@/lib/db";
import { can } from "@/lib/authz";
import { daysUntil, isLowStock } from "@/lib/calc/inventory";
import { getWeather, resolveLocation } from "@/integrations/weather/service";
import { forecastAlerts } from "@/integrations/weather/advisory";
import { date as fmtDate, todayISO } from "@/lib/format";

const lastRun = new Map<string, number>();

type N = { userId: string; farmId?: string; type: string; title: string; body: string; link?: string; dedupeKey: string };

/**
 * Derives reminders from the user's own records (tasks, stock, wages, scheme follow-ups) and from integrated
 * weather forecasts. Notifications are de-duplicated by key, so re-running is safe. Throttled per user.
 */
export async function generateNotifications(userId: string, force = false) {
  if (!force && Date.now() - (lastRun.get(userId) ?? 0) < 10 * 60 * 1000) return;
  lastRun.set(userId, Date.now());
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const memberships = await prisma.farmMembership.findMany({ where: { userId }, include: { farm: true } });
  const out: N[] = [];
  const today = new Date(todayISO() + "T00:00:00Z");
  const horizon = new Date(today.getTime() + 14 * 86400000);

  for (const m of memberships) {
    const farm = m.farm;
    if (settings?.notifyTasks ?? true) {
      const tasks = await prisma.task.findMany({ where: { farmId: farm.id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] }, date: { lte: horizon } } });
      for (const t of tasks) {
        const days = daysUntil(t.date)!;
        const remind = t.reminderDays ?? settings?.taskReminderDays ?? 2;
        if (days < 0) out.push({ userId, farmId: farm.id, type: "TASK", title: `Overdue: ${t.title}`, body: `Was planned for ${fmtDate(t.date)} on ${farm.name}. Mark it done or move the date.`, link: "/app/calendar", dedupeKey: `task-overdue:${t.id}:${t.date.toISOString().slice(0, 10)}` });
        else if (days <= remind) out.push({ userId, farmId: farm.id, type: "TASK", title: days === 0 ? `Today: ${t.title}` : `In ${days} day${days > 1 ? "s" : ""}: ${t.title}`, body: `${farm.name} · ${fmtDate(t.date)}${t.time ? ` at ${t.time}` : ""}`, link: "/app/calendar", dedupeKey: `task-due:${t.id}:${t.date.toISOString().slice(0, 10)}` });
      }
      const followUps = await prisma.activity.findMany({ where: { farmId: farm.id, deletedAt: null, followUpDate: { gte: today, lte: new Date(today.getTime() + 3 * 86400000) } }, include: { plot: true } });
      for (const a of followUps) out.push({ userId, farmId: farm.id, type: "TASK", title: `Follow-up due: ${a.productName ?? a.type.toLowerCase().replace("_", " ")}`, body: `${a.plot?.name ?? farm.name} · follow-up on ${fmtDate(a.followUpDate)}`, link: `/app/diary/${a.id}`, dedupeKey: `followup:${a.id}` });
    }
    if (settings?.notifyInventory ?? true) {
      const items = await prisma.inventoryItem.findMany({ where: { farmId: farm.id, deletedAt: null } });
      for (const it of items) {
        if (isLowStock(Number(it.quantity), it.lowStockThreshold == null ? null : Number(it.lowStockThreshold)))
          out.push({ userId, farmId: farm.id, type: "INVENTORY", title: `Low stock: ${it.name}`, body: `${Number(it.quantity)} ${it.unit} left on ${farm.name} (alert level ${Number(it.lowStockThreshold)}).`, link: `/app/inventory/${it.id}`, dedupeKey: `lowstock:${it.id}:${Number(it.quantity)}` });
        const dExp = daysUntil(it.expiryDate);
        if (dExp != null && dExp <= 30 && Number(it.quantity) > 0)
          out.push({ userId, farmId: farm.id, type: "INVENTORY", title: dExp < 0 ? `Expired: ${it.name}` : `Expires in ${dExp} days: ${it.name}`, body: `${Number(it.quantity)} ${it.unit} · expiry ${fmtDate(it.expiryDate)}`, link: `/app/inventory/${it.id}`, dedupeKey: `expiry:${it.id}:${dExp < 0 ? "expired" : "soon"}` });
      }
    }
    if ((settings?.notifyPayments ?? true) && can(m.role, "finance:read")) {
      const old = await prisma.laborRecord.findMany({ where: { farmId: farm.id, deletedAt: null, workStatus: "COMPLETED", paymentStatus: { not: "PAID" }, date: { lte: new Date(today.getTime() - 7 * 86400000) } }, include: { worker: true } });
      for (const r of old) {
        const pending = Number(r.totalCost) - Number(r.amountPaid);
        out.push({ userId, farmId: farm.id, type: "PAYMENT", title: `Wage pending: ${r.worker?.name ?? r.workerLabel ?? `${r.workerCount} workers`}`, body: `₹${pending.toLocaleString("en-IN")} pending for work on ${fmtDate(r.date)}.`, link: "/app/labor", dedupeKey: `wage:${r.id}:${pending}` });
      }
    }
    if (settings?.notifyWeather ?? true) {
      const loc = resolveLocation(farm);
      const w = await getWeather(loc.lat, loc.lon, loc.label).catch(() => null);
      if (w && !w.stale) {
        for (const a of forecastAlerts(w.daily).filter((x) => x.level === "warning"))
          out.push({ userId, farmId: farm.id, type: "WEATHER", title: `${a.title} — ${fmtDate(a.date)}`, body: `${farm.name}: ${a.detail} (Source: ${w.provider})`, link: "/app/weather", dedupeKey: `wx:${farm.id}:${a.date}:${a.title}` });
      }
    }
  }

  const trackers = await prisma.schemeTracker.findMany({ where: { userId, followUpDate: { lte: new Date(today.getTime() + 2 * 86400000) }, status: { notIn: ["APPROVED", "REJECTED", "NOT_ELIGIBLE"] } }, include: { scheme: true } });
  for (const t of trackers) out.push({ userId, type: "SCHEME", title: `Scheme follow-up: ${t.scheme.name}`, body: `You planned to follow up on ${fmtDate(t.followUpDate)}.`, link: `/app/schemes/${t.scheme.slug}`, dedupeKey: `scheme:${t.id}:${t.followUpDate?.toISOString().slice(0, 10)}` });

  if (settings?.notifyPriceAlerts ?? true) {
    const alerts = await prisma.priceAlert.findMany({ where: { userId, active: true } });
    for (const a of alerts) {
      const latest = await prisma.marketPrice.findFirst({ where: { cropKey: a.cropKey, ...(a.market ? { market: a.market } : {}) }, orderBy: { priceDate: "desc" } });
      if (!latest) continue;
      const price = Number(latest.modalPrice);
      const hit = a.direction === "ABOVE" ? price >= Number(a.threshold) : price <= Number(a.threshold);
      if (hit)
        out.push({ userId, type: "PRICE", title: `Price alert: ${a.cropKey} ${a.direction === "ABOVE" ? "≥" : "≤"} ₹${Number(a.threshold).toLocaleString("en-IN")}`, body: `${latest.market}: modal ₹${price.toLocaleString("en-IN")}/${latest.unit.replace("Rs/", "")} on ${fmtDate(latest.priceDate)}. Source: ${latest.source}${latest.dataKind === "SAMPLE" ? " (SAMPLE data — not a real price)" : ""}.`, link: "/app/market", dedupeKey: `price:${a.id}:${latest.priceDate.toISOString().slice(0, 10)}:${latest.market}` });
    }
  }

  if (out.length) await prisma.notification.createMany({ data: out, skipDuplicates: true });
}
