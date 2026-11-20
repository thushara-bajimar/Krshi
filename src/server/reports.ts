import "server-only";
import { prisma } from "@/lib/db";
import { can } from "@/lib/authz";
import { forbidden, notFound } from "@/lib/errors";
import { periodRange } from "@/lib/calc/finance";
import { loadFinance } from "./finance";

export const REPORT_TYPES = {
  farm: "Farm performance (complete)",
  expense: "Expense report",
  labor: "Labour report",
  crop: "Crop-wise expense & income",
  income: "Income & sales report",
  harvest: "Harvest report",
  activity: "Activity report",
  inventory: "Inventory report",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;
const FINANCIAL: ReportType[] = ["farm", "expense", "labor", "crop", "income"];

export interface ReportParams { type: ReportType; period: string; from?: string; to?: string; farmId: string; plotId?: string; cropId?: string }

export function parseReportParams(sp: Record<string, string | undefined>, defaultFarm: string): ReportParams {
  const type = (sp.type && sp.type in REPORT_TYPES ? sp.type : "farm") as ReportType;
  return { type, period: sp.period ?? "year", from: sp.from, to: sp.to, farmId: sp.farm ?? defaultFarm, plotId: sp.plot || undefined, cropId: sp.crop || undefined };
}

export async function loadReport(userId: string, p: ReportParams) {
  const m = await prisma.farmMembership.findUnique({ where: { farmId_userId: { farmId: p.farmId, userId } }, include: { farm: true } });
  if (!m) throw notFound("Farm not found");
  if (FINANCIAL.includes(p.type) && !can(m.role, "finance:read")) throw forbidden("Your role cannot view financial reports");
  const finOk = can(m.role, "finance:read");
  const range = p.period === "custom" && p.from && p.to ? { from: new Date(p.from), to: new Date(p.to) } : periodRange((["month", "season", "year"].includes(p.period) ? p.period : "year") as "month" | "season" | "year");
  const scope = { farmId: p.farmId, ...(p.plotId ? { plotId: p.plotId } : {}), ...(p.cropId ? { cropId: p.cropId } : {}) };
  const dateR = { gte: range.from, lte: range.to };
  const [fin, activities, harvests, inventory, plot, crop, plots] = await Promise.all([
    finOk ? loadFinance({ farmIds: [p.farmId], ...range, plotId: p.plotId, cropId: p.cropId }) : null,
    prisma.activity.findMany({ where: { ...scope, deletedAt: null, date: dateR }, include: { plot: true, crop: true }, orderBy: { date: "asc" } }),
    prisma.harvest.findMany({ where: { ...scope, deletedAt: null, date: dateR }, include: { plot: true, crop: true, sales: { where: { deletedAt: null } } }, orderBy: { date: "asc" } }),
    prisma.inventoryItem.findMany({ where: { farmId: p.farmId, deletedAt: null }, include: { transactions: { where: { date: dateR } } }, orderBy: { name: "asc" } }),
    p.plotId ? prisma.plot.findUnique({ where: { id: p.plotId } }) : null,
    p.cropId ? prisma.crop.findUnique({ where: { id: p.cropId } }) : null,
    prisma.plot.findMany({ where: { farmId: p.farmId }, include: { crop: true }, orderBy: { name: "asc" } }),
  ]);
  return { farm: m.farm, role: m.role, finOk, range, fin, activities, harvests, inventory, plot, crop, plots, generatedAt: new Date() };
}

// ---- CSV
const esc = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");

export function reportCsv(r: Awaited<ReturnType<typeof loadReport>>, type: ReportType): { name: string; csv: string } {
  const f = r.fin;
  switch (type) {
    case "expense":
      return { name: "expenses", csv: toCsv(["date", "category", "description", "plot", "crop", "vendor", "payment_method", "amount_inr"], f!.expenses.map((e) => [e.date, e.category, e.description, e.plot?.name, e.crop?.name, e.vendor, e.paymentMethod, Number(e.amount)])) };
    case "labor":
      return { name: "labour", csv: toCsv(["date", "worker", "workers", "work", "plot", "wage_type", "units", "rate_inr", "extra_inr", "total_inr", "paid_inr", "status"], f!.labor.map((l) => [l.date, l.worker?.name ?? l.workerLabel, l.workerCount, l.taskCategory, l.plot?.name, l.wageType, Number(l.units), Number(l.rate), Number(l.additionalCost), Number(l.totalCost), Number(l.amountPaid), l.paymentStatus])) };
    case "income":
    case "crop":
      return { name: "income", csv: toCsv(["date", "type", "crop", "plot", "quantity", "unit", "price_per_unit", "gross_inr", "transport_inr", "deductions_inr", "net_inr", "received_inr", "buyer", "market"], f!.incomes.map((i) => [i.date, i.source, i.crop?.name, i.plot?.name, i.quantity == null ? "" : Number(i.quantity), i.unit, i.pricePerUnit == null ? "" : Number(i.pricePerUnit), Number(i.grossAmount), Number(i.transportCost), Number(i.otherDeductions), Number(i.netAmount), i.amountReceived == null ? "" : Number(i.amountReceived), i.buyer, i.market])) };
    case "harvest":
      return { name: "harvests", csv: toCsv(["date", "crop", "plot", "quantity", "unit", "grade", "sold", "storage"], r.harvests.map((h) => [h.date, h.crop.name, h.plot?.name, Number(h.quantity), h.unit, h.grade, h.sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0), h.storage])) };
    case "inventory":
      return { name: "inventory", csv: toCsv(["item", "category", "unit", "in_stock", "low_stock_level", "expiry", "purchased_in_period", "used_in_period", "wasted_in_period"], r.inventory.map((i) => [i.name, i.category, i.unit, Number(i.quantity), i.lowStockThreshold == null ? "" : Number(i.lowStockThreshold), i.expiryDate, ...(["PURCHASE", "USAGE", "WASTAGE"] as const).map((t) => i.transactions.filter((x) => x.type === t).reduce((a, x) => a + Number(x.quantity), 0))])) };
    default:
      return { name: "activities", csv: toCsv(["date", "type", "plot", "crop", "product", "quantity", "unit", "dilution", "water", "area_covered", "cost_inr", "done_by", "source", "notes"], r.activities.map((a) => [a.date, a.type, a.plot?.name, a.crop?.name, a.productName, a.quantity == null ? "" : Number(a.quantity), a.quantityUnit, a.dilution, a.waterQuantity == null ? "" : Number(a.waterQuantity), a.areaCovered == null ? "" : Number(a.areaCovered), r.finOk && a.cost != null ? Number(a.cost) : "", a.laborDetails, a.sourceReference, a.notes])) };
  }
}
