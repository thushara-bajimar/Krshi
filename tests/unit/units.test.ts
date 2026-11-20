import { describe, expect, it } from "vitest";
import { AREA_TO_SQM, convertArea, convertQuantity, humanizeQuantity, round } from "@/lib/units";

describe("area conversion", () => {
  it("uses exact definitions", () => {
    expect(convertArea(1, "ACRE", "SQ_M")).toBeCloseTo(4046.8564224, 7);
    expect(convertArea(1, "HECTARE", "ACRE")).toBeCloseTo(2.4710538147, 8);
    expect(convertArea(100, "CENT", "ACRE")).toBeCloseTo(1, 12);
    expect(convertArea(40, "GUNTA", "ACRE")).toBeCloseTo(1, 12);
    expect(convertArea(1, "ACRE", "CENT")).toBeCloseTo(100, 10);
  });
  it("round-trips", () => {
    for (const from of Object.keys(AREA_TO_SQM) as (keyof typeof AREA_TO_SQM)[])
      for (const to of Object.keys(AREA_TO_SQM) as (keyof typeof AREA_TO_SQM)[])
        expect(convertArea(convertArea(3.7, from, to), to, from)).toBeCloseTo(3.7, 9);
  });
  it("rejects non-finite input", () => {
    expect(() => convertArea(NaN, "ACRE", "CENT")).toThrow();
  });
});

describe("quantity conversion", () => {
  it("converts mass and volume", () => {
    expect(convertQuantity(2.5, "kg", "g")).toBe(2500);
    expect(convertQuantity(1, "quintal", "kg")).toBe(100);
    expect(convertQuantity(1, "tonne", "quintal")).toBe(10);
    expect(convertQuantity(750, "ml", "l")).toBe(0.75);
  });
  it("refuses mass <-> volume (density unknown)", () => {
    expect(() => convertQuantity(1, "kg", "l")).toThrow(/different dimensions/);
  });
  it("humanizes", () => {
    expect(humanizeQuantity(2500, "g")).toEqual({ value: 2.5, unit: "kg" });
    expect(humanizeQuantity(0.4, "l")).toEqual({ value: 400, unit: "ml" });
    expect(humanizeQuantity(1500, "kg")).toEqual({ value: 1.5, unit: "tonne" });
  });
  it("rounds half away correctly", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
  });
});
