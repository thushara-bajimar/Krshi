import { describe, expect, it } from "vitest";
import { calculateDosage } from "@/lib/calc/dosage";

describe("application calculator", () => {
  it("scales a per-area dose to the plot area across units", () => {
    // 50 kg per acre, plot of 50 cents (= 0.5 acre)
    const r = calculateDosage({ dose: 50, doseUnit: "kg", basis: { kind: "per_area", area: 1, areaUnit: "ACRE" }, targetArea: 50, targetAreaUnit: "CENT" });
    expect(r.productQuantity).toBeCloseTo(25, 6);
    expect(r.display).toEqual({ value: 25, unit: "kg" });
  });
  it("per hectare dose applied to acres", () => {
    const r = calculateDosage({ dose: 10, doseUnit: "kg", basis: { kind: "per_area", area: 1, areaUnit: "HECTARE" }, targetArea: 2, targetAreaUnit: "ACRE" });
    expect(r.productQuantity).toBeCloseTo(8.0937, 3);
  });
  it("per-litre spray concentration with spray volume per area", () => {
    // 2 ml per litre, sprayer uses 200 L per acre, 1.5 acres -> 300 L water, 600 ml product
    const r = calculateDosage({ dose: 2, doseUnit: "ml", basis: { kind: "per_litre", litres: 1 }, targetArea: 1.5, targetAreaUnit: "ACRE", sprayVolumePerArea: { litres: 200, area: 1, areaUnit: "ACRE" } });
    expect(r.waterLitres).toBe(300);
    expect(r.productQuantity).toBe(600);
    expect(r.display).toEqual({ value: 600, unit: "ml" });
  });
  it("per-litre with explicit water", () => {
    const r = calculateDosage({ dose: 10, doseUnit: "g", basis: { kind: "per_litre", litres: 1 }, waterLitres: 250 });
    expect(r.display).toEqual({ value: 2.5, unit: "kg" });
  });
  it("per plant", () => {
    const r = calculateDosage({ dose: 500, doseUnit: "g", basis: { kind: "per_plant", plants: 1 }, plantCount: 900 });
    expect(r.display).toEqual({ value: 450, unit: "kg" });
  });
  it("cost and stock shortfall", () => {
    // need 25 kg, price ₹1200 per 50 kg bag, have 20 kg
    const r = calculateDosage({ dose: 50, doseUnit: "kg", basis: { kind: "per_area", area: 1, areaUnit: "ACRE" }, targetArea: 0.5, targetAreaUnit: "ACRE", price: { amount: 1200, per: 50, unit: "kg" }, available: { quantity: 20, unit: "kg" } });
    expect(r.costEstimate).toBe(600);
    expect(r.shortfall).toEqual({ value: 5, unit: "kg" });
  });
  it("cost with unit conversion (dose in g, price per kg)", () => {
    const r = calculateDosage({ dose: 250, doseUnit: "g", basis: { kind: "per_plant", plants: 1 }, plantCount: 10, price: { amount: 80, per: 1, unit: "kg" } });
    expect(r.costEstimate).toBe(200);
  });
  it("validates inputs and never invents a dose", () => {
    expect(() => calculateDosage({ dose: 0, doseUnit: "kg", basis: { kind: "per_area", area: 1, areaUnit: "ACRE" }, targetArea: 1, targetAreaUnit: "ACRE" })).toThrow(/greater than zero/);
    expect(() => calculateDosage({ dose: 1, doseUnit: "kg", basis: { kind: "per_area", area: 1, areaUnit: "ACRE" } })).toThrow(/area/);
    expect(() => calculateDosage({ dose: 1, doseUnit: "kg", basis: { kind: "per_litre", litres: 1 } })).toThrow(/water/);
    expect(() => calculateDosage({ dose: 1, doseUnit: "kg", basis: { kind: "per_plant", plants: 1 }, plantCount: 5, price: { amount: 10, per: 1, unit: "l" } })).toThrow(/same kind/);
  });
});
