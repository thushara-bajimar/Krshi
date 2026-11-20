import { fromPaise, toPaise } from "./money";

export interface Dated { date: Date | string }
export interface ExpenseLike extends Dated { amount: number | string; category: string; cropKey?: string | null; plotId?: string | null }
export interface IncomeLike extends Dated { netAmount: number | string; grossAmount?: number | string; cropKey?: string | null }

export function monthKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function financeSummary(expenses: ExpenseLike[], incomes: IncomeLike[]) {
  const exp = expenses.reduce((a, e) => a + toPaise(e.amount), 0);
  const inc = incomes.reduce((a, i) => a + toPaise(i.netAmount), 0);
  return { totalExpense: fromPaise(exp), totalIncome: fromPaise(inc), net: fromPaise(inc - exp) };
}

export function groupSum<T>(items: T[], key: (t: T) => string, value: (t: T) => number | string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    out[k] = (out[k] ?? 0) + toPaise(value(it));
  }
  for (const k of Object.keys(out)) out[k] = fromPaise(out[k]);
  return out;
}

/** Continuous list of months between two dates (inclusive), e.g. for charts with no gaps. */
export function monthRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (d <= end) {
    out.push(monthKey(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export function monthlySeries(expenses: ExpenseLike[], incomes: IncomeLike[], from: Date, to: Date) {
  const e = groupSum(expenses, (x) => monthKey(x.date), (x) => x.amount);
  const i = groupSum(incomes, (x) => monthKey(x.date), (x) => x.netAmount);
  return monthRange(from, to).map((m) => ({
    month: m,
    expense: e[m] ?? 0,
    income: i[m] ?? 0,
    net: fromPaise(toPaise(i[m] ?? 0) - toPaise(e[m] ?? 0)),
  }));
}

/** Sale net amount = gross − transport − other deductions. Gross = qty × price when not given. */
export function saleAmounts(input: { quantity?: number | null; pricePerUnit?: number | null; grossAmount?: number | null; transportCost?: number; otherDeductions?: number }) {
  let gross = input.grossAmount;
  if (gross == null) {
    if (input.quantity == null || input.pricePerUnit == null) throw new Error("Enter either the total amount or quantity and price");
    gross = Math.round(input.quantity * input.pricePerUnit * 100) / 100;
  }
  const net = fromPaise(toPaise(gross) - toPaise(input.transportCost ?? 0) - toPaise(input.otherDeductions ?? 0));
  return { grossAmount: gross, netAmount: net };
}

export const INPUT_CATEGORIES = new Set(["FERTILIZER", "PESTICIDE", "SEEDS", "IRRIGATION"]);

/** Period helpers used by reports */
export function periodRange(period: "month" | "season" | "year" | "custom", ref = new Date(), custom?: { from: string; to: string }) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (period === "month") return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 0)) };
  if (period === "year") {
    // Indian financial year: April – March
    const start = m >= 3 ? y : y - 1;
    return { from: new Date(Date.UTC(start, 3, 1)), to: new Date(Date.UTC(start + 1, 2, 31)) };
  }
  if (period === "season") {
    // Karnataka cropping seasons: Kharif (Jun–Sep), Rabi (Oct–Jan), Summer (Feb–May)
    if (m >= 5 && m <= 8) return { from: new Date(Date.UTC(y, 5, 1)), to: new Date(Date.UTC(y, 8, 30)) };
    if (m >= 9) return { from: new Date(Date.UTC(y, 9, 1)), to: new Date(Date.UTC(y + 1, 0, 31)) };
    if (m === 0) return { from: new Date(Date.UTC(y - 1, 9, 1)), to: new Date(Date.UTC(y, 0, 31)) };
    return { from: new Date(Date.UTC(y, 1, 1)), to: new Date(Date.UTC(y, 4, 31)) };
  }
  if (!custom) throw new Error("Custom period requires from/to");
  return { from: new Date(custom.from), to: new Date(custom.to) };
}
