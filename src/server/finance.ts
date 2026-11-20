import "server-only";
import { prisma } from "@/lib/db";
import { financeSummary, groupSum, monthlySeries, INPUT_CATEGORIES } from "@/lib/calc/finance";
import { fromPaise, toPaise } from "@/lib/calc/money";

export interface FinanceFilter {
  farmIds: string[];
  from: Date;
  to: Date;
  plotId?: string;
  cropId?: string;
}

/**
 * Unified money view. Labour is taken from labour records (completed work, by work date) and shown under the
 * LABOR category — the expense table's LABOR category is for labour not recorded in the labour module.
 */
export async function loadFinance(f: FinanceFilter) {
  const where = { farmId: { in: f.farmIds }, deletedAt: null, date: { gte: f.from, lte: f.to }, ...(f.plotId ? { plotId: f.plotId } : {}), ...(f.cropId ? { cropId: f.cropId } : {}) };
  const laborWhere = { farmId: { in: f.farmIds }, deletedAt: null, workStatus: "COMPLETED" as const, date: { gte: f.from, lte: f.to }, ...(f.plotId ? { plotId: f.plotId } : {}), ...(f.cropId ? { plot: { cropId: f.cropId } } : {}) };
  const [expenses, incomes, labor] = await Promise.all([
    prisma.expense.findMany({ where, include: { crop: true, plot: true }, orderBy: { date: "desc" } }),
    prisma.income.findMany({ where, include: { crop: true, plot: true }, orderBy: { date: "desc" } }),
    prisma.laborRecord.findMany({ where: laborWhere, include: { plot: { include: { crop: true } }, worker: true }, orderBy: { date: "desc" } }),
  ]);

  const expenseRows = [
    ...expenses.map((e) => ({ date: e.date, amount: Number(e.amount), category: e.category as string, cropName: e.crop?.name ?? "Unassigned", plotName: e.plot?.name ?? "Whole farm", farmId: e.farmId, source: "expense" as const })),
    ...labor.map((l) => ({ date: l.date, amount: Number(l.totalCost), category: "LABOR", cropName: l.plot?.crop?.name ?? "Unassigned", plotName: l.plot?.name ?? "Whole farm", farmId: l.farmId, source: "labour" as const })),
  ];
  const incomeRows = incomes.map((i) => ({ date: i.date, netAmount: Number(i.netAmount), grossAmount: Number(i.grossAmount), cropName: i.crop?.name ?? "Other income", farmId: i.farmId }));

  const summary = financeSummary(expenseRows, incomeRows);
  const byCategory = groupSum(expenseRows, (e) => e.category, (e) => e.amount);
  const byCrop = groupSum(expenseRows, (e) => e.cropName, (e) => e.amount);
  const byPlot = groupSum(expenseRows, (e) => e.plotName, (e) => e.amount);
  const incomeByCrop = groupSum(incomeRows, (i) => i.cropName, (i) => i.netAmount);
  const laborTotal = byCategory.LABOR ?? 0;
  const inputTotal = fromPaise(Object.entries(byCategory).filter(([k]) => INPUT_CATEGORIES.has(k)).reduce((a, [, v]) => a + toPaise(v), 0));
  const receivable = fromPaise(incomes.reduce((a, i) => a + Math.max(0, toPaise(i.netAmount) - toPaise(i.amountReceived ?? i.netAmount)), 0));
  const wagesPending = fromPaise(labor.reduce((a, l) => a + Math.max(0, toPaise(l.totalCost) - toPaise(l.amountPaid)), 0));

  return {
    summary,
    monthly: monthlySeries(expenseRows, incomeRows, f.from, f.to),
    byCategory,
    byCrop,
    byPlot,
    incomeByCrop,
    laborTotal,
    inputTotal,
    receivable,
    wagesPending,
    expenses,
    incomes,
    labor,
    counts: { expenses: expenses.length, incomes: incomes.length, labor: labor.length },
  };
}

export async function pendingWages(farmId: string) {
  const recs = await prisma.laborRecord.findMany({ where: { farmId, deletedAt: null, paymentStatus: { not: "PAID" }, workStatus: "COMPLETED" }, include: { worker: true }, orderBy: { date: "asc" } });
  const total = fromPaise(recs.reduce((a, r) => a + toPaise(r.totalCost) - toPaise(r.amountPaid), 0));
  return { total, records: recs };
}
