import { describe, expect, it } from "vitest";
import { laborTotal, paymentStatus, pendingAmount } from "@/lib/calc/labor";
import { financeSummary, groupSum, monthlySeries, monthRange, periodRange, saleAmounts } from "@/lib/calc/finance";
import { sumMoney, mulMoney } from "@/lib/calc/money";
import { stockDelta, isLowStock } from "@/lib/calc/inventory";
import { costPerUnit, harvestRemaining, yieldPerArea } from "@/lib/calc/yield";

describe("money", () => {
  it("sums without float drift", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(["100.10", 200.2, null, undefined])).toBe(300.3);
    expect(mulMoney(3, 1, 333.33)).toBe(999.99);
  });
});

describe("labour", () => {
  it("3 workers × 1 day × ₹800 = ₹2400", () => {
    expect(laborTotal({ workerCount: 3, units: 1, rate: 800 })).toBe(2400);
  });
  it("hourly, half-day, task and extra costs", () => {
    expect(laborTotal({ workerCount: 2, units: 4.5, rate: 120 })).toBe(1080);
    expect(laborTotal({ workerCount: 1, units: 2, rate: 400 })).toBe(800);
    expect(laborTotal({ workerCount: 1, units: 80, rate: 50 })).toBe(4000); // 80 palms climbed @ ₹50
    expect(laborTotal({ workerCount: 6, units: 1, rate: 700, additionalCost: 300 })).toBe(4500);
  });
  it("rejects invalid values", () => {
    expect(() => laborTotal({ workerCount: -1, units: 1, rate: 100 })).toThrow();
    expect(() => laborTotal({ workerCount: 1.5, units: 1, rate: 100 })).toThrow();
  });
  it("payment status and pending", () => {
    expect(paymentStatus(2400, 0)).toBe("PENDING");
    expect(paymentStatus(2400, 1000)).toBe("PARTIAL");
    expect(paymentStatus(2400, 2400)).toBe("PAID");
    expect(paymentStatus(0, 0)).toBe("PAID");
    expect(pendingAmount(2400, 1000.5)).toBe(1399.5);
    expect(pendingAmount(100, 150)).toBe(0);
  });
});

describe("finance", () => {
  const exp = [{ date: "2026-06-03", amount: 1000.1, category: "FERTILIZER" }, { date: "2026-07-10", amount: "250.20", category: "LABOR" }, { date: "2026-07-11", amount: 49.7, category: "FERTILIZER" }];
  const inc = [{ date: "2026-07-20", netAmount: 5000 }, { date: "2026-08-01", netAmount: "1200.55" }];
  it("totals and net", () => {
    expect(financeSummary(exp, inc)).toEqual({ totalExpense: 1300, totalIncome: 6200.55, net: 4900.55 });
    expect(financeSummary([], [])).toEqual({ totalExpense: 0, totalIncome: 0, net: 0 });
  });
  it("groups by category", () => {
    expect(groupSum(exp, (e) => e.category, (e) => e.amount)).toEqual({ FERTILIZER: 1049.8, LABOR: 250.2 });
  });
  it("monthly series has no gaps", () => {
    const s = monthlySeries(exp, inc, new Date("2026-05-15"), new Date("2026-08-31"));
    expect(s.map((m) => m.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(s[2]).toEqual({ month: "2026-07", expense: 299.9, income: 5000, net: 4700.1 });
    expect(monthRange(new Date("2025-11-30"), new Date("2026-02-01"))).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("sale amounts: gross from qty × price, net after deductions", () => {
    expect(saleAmounts({ quantity: 400, pricePerUnit: 470, transportCost: 500 })).toEqual({ grossAmount: 188000, netAmount: 187500 });
    expect(saleAmounts({ grossAmount: 1000, transportCost: 50.5, otherDeductions: 20 })).toEqual({ grossAmount: 1000, netAmount: 929.5 });
    expect(() => saleAmounts({ quantity: 1 })).toThrow();
  });
  it("Indian financial year and seasons", () => {
    expect(periodRange("year", new Date(2026, 10, 20))).toEqual({ from: new Date(Date.UTC(2026, 3, 1)), to: new Date(Date.UTC(2027, 2, 31)) });
    expect(periodRange("year", new Date(2026, 1, 1)).from).toEqual(new Date(Date.UTC(2025, 3, 1)));
    expect(periodRange("season", new Date(2026, 6, 1))).toEqual({ from: new Date(Date.UTC(2026, 5, 1)), to: new Date(Date.UTC(2026, 8, 30)) });
    expect(periodRange("month", new Date(2026, 1, 10)).to).toEqual(new Date(Date.UTC(2026, 1, 28)));
  });
});

describe("inventory", () => {
  it("computes signed deltas and blocks over-use", () => {
    expect(stockDelta("PURCHASE", 10, 5)).toBe(10);
    expect(stockDelta("USAGE", 3, 5)).toBe(-3);
    expect(stockDelta("WASTAGE", 5, 5)).toBe(-5);
    expect(stockDelta("ADJUSTMENT", 7, 5)).toBe(2);
    expect(stockDelta("ADJUSTMENT", 2, 5)).toBe(-3);
    expect(() => stockDelta("USAGE", 6, 5)).toThrow(/Only 5 in stock/);
    expect(() => stockDelta("PURCHASE", -1, 5)).toThrow();
  });
  it("low stock", () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(11, 10)).toBe(false);
    expect(isLowStock(1, null)).toBe(false);
  });
});

describe("yield", () => {
  it("per acre with unit conversion", () => {
    expect(yieldPerArea(1450, 2, "ACRE")).toBe(725);
    expect(yieldPerArea(1000, 1, "HECTARE")).toBeCloseTo(404.686, 3);
    expect(yieldPerArea(10, 0, "ACRE")).toBeNull();
  });
  it("remaining and cost per unit", () => {
    expect(harvestRemaining(1450, 1300)).toBe(150);
    expect(harvestRemaining(10, 12)).toBe(0);
    expect(costPerUnit(29000, 1450)).toBe(20);
    expect(costPerUnit(100, 0)).toBeNull();
  });
});
