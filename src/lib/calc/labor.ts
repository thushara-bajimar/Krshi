import { fromPaise, mulMoney, toPaise } from "./money";

export type WageType = "DAILY" | "HALF_DAY" | "HOURLY" | "TASK";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";

export interface LaborCostInput {
  workerCount: number; // number of workers covered by this record
  units: number; // days / half-days / hours / tasks per worker
  rate: number; // rate per unit per worker (₹)
  additionalCost?: number; // food, transport, etc. for the whole record
}

export function laborTotal({ workerCount, units, rate, additionalCost = 0 }: LaborCostInput): number {
  if (workerCount < 0 || units < 0 || rate < 0 || additionalCost < 0) throw new Error("Labour values cannot be negative");
  if (!Number.isInteger(workerCount)) throw new Error("Worker count must be a whole number");
  return fromPaise(toPaise(mulMoney(workerCount, units, rate)) + toPaise(additionalCost));
}

export function paymentStatus(total: number, paid: number): PaymentStatus {
  const t = toPaise(total);
  const p = toPaise(paid);
  if (p <= 0) return t === 0 ? "PAID" : "PENDING";
  if (p >= t) return "PAID";
  return "PARTIAL";
}

export function pendingAmount(total: number, paid: number): number {
  return Math.max(0, fromPaise(toPaise(total) - toPaise(paid)));
}

export const WAGE_UNIT_LABEL: Record<WageType, string> = {
  DAILY: "days",
  HALF_DAY: "half-days",
  HOURLY: "hours",
  TASK: "tasks",
};
