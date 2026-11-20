import { describe, expect, it } from "vitest";
import { checkRelevance } from "@/lib/schemes";
import { activitySchema, incomeSchema, inputProductSchema, laborSchema, registerSchema, soilTestSchema } from "@/lib/validation/schemas";

const farmId = "11111111-1111-4111-8111-111111111111";

describe("scheme relevance (never an eligibility decision)", () => {
  it("fits basics only when every checkable rule passes", () => {
    expect(checkRelevance({ landholder: true, notIncomeTaxPayer: true }, { ownsLand: true, incomeTaxPayer: false }).verdict).toBe("fits_basics");
  });
  it("does not fit with a reason", () => {
    const r = checkRelevance({ landholder: true, notIncomeTaxPayer: true }, { ownsLand: true, incomeTaxPayer: true });
    expect(r.verdict).toBe("does_not_fit");
    expect(r.reasons.join(" ")).toMatch(/income-tax/i);
  });
  it("asks for missing information instead of guessing", () => {
    const r = checkRelevance({ minAge: 18, maxAge: 40, smallMarginal: true }, {});
    expect(r.verdict).toBe("need_info");
    expect(r.missing.length).toBe(2);
  });
  it("small & marginal = up to 2 ha", () => {
    expect(checkRelevance({ smallMarginal: true }, { landAcres: 4.9 }).verdict).toBe("fits_basics");
    expect(checkRelevance({ smallMarginal: true }, { landAcres: 5.5 }).verdict).toBe("does_not_fit");
  });
  it("crop-specific schemes", () => {
    expect(checkRelevance({ crop: "coconut" }, { crops: ["arecanut"] }).verdict).toBe("does_not_fit");
    expect(checkRelevance({ crop: "coconut" }, { crops: ["coconut", "paddy"] }).verdict).toBe("fits_basics");
  });
});

describe("validation", () => {
  it("coerces form strings and drops empty optionals", () => {
    const r = activitySchema.parse({ farmId, type: "FERTILIZER", date: "2026-11-20", quantity: "12.5", cost: "", plotId: "" });
    expect(r.quantity).toBe(12.5);
    expect(r.cost).toBeUndefined();
    expect(r.plotId).toBeUndefined();
  });
  it("rejects bad dates, negative numbers and unknown types", () => {
    expect(activitySchema.safeParse({ farmId, type: "FERTILIZER", date: "20/11/2026" }).success).toBe(false);
    expect(activitySchema.safeParse({ farmId, type: "MAGIC", date: "2026-11-20" }).success).toBe(false);
    expect(activitySchema.safeParse({ farmId, type: "FERTILIZER", date: "2026-11-20", quantity: "-2" }).success).toBe(false);
  });
  it("labour requires a positive number of units", () => {
    expect(laborSchema.safeParse({ farmId, taskCategory: "spraying", date: "2026-11-20", wageType: "DAILY", units: "0", rate: "800" }).success).toBe(false);
    expect(laborSchema.parse({ farmId, taskCategory: "spraying", date: "2026-11-20", wageType: "DAILY", units: "1", rate: "800", workerCount: "3" }).workerCount).toBe(3);
  });
  it("a sale needs quantity & price or a total", () => {
    expect(incomeSchema.safeParse({ farmId, date: "2026-11-20", quantity: "10" }).success).toBe(false);
    expect(incomeSchema.safeParse({ farmId, date: "2026-11-20", grossAmount: "1000" }).success).toBe(true);
  });
  it("a saved dose must cite its source", () => {
    expect(inputProductSchema.safeParse({ name: "X", category: "fungicide", dose: "2" }).success).toBe(false);
    expect(inputProductSchema.safeParse({ name: "X", category: "fungicide", dose: "2", sourceReference: "Product label" }).success).toBe(true);
    expect(inputProductSchema.safeParse({ name: "X", category: "fungicide" }).success).toBe(true);
  });
  it("soil pH range and registration rules", () => {
    expect(soilTestSchema.safeParse({ farmId, testDate: "2026-01-01", ph: "15" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "short" }).success).toBe(false);
    expect(registerSchema.parse({ name: "A", email: " A@B.co ", password: "longenough" }).email).toBe("a@b.co");
  });
});
