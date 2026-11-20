// Compares a farmer's own answers with the machine-checkable subset of a scheme's PUBLISHED criteria.
// It never decides eligibility: the result is "fits the basics / does not fit / need more info", always with reasons,
// and the UI always points to the official portal for the full rules.

export interface SchemeAnswers {
  ownsLand?: boolean | null;
  landAcres?: number | null;
  incomeTaxPayer?: boolean | null;
  age?: number | null;
  hasWaterSource?: boolean | null;
  inKarnataka?: boolean | null;
  crops?: string[];
}

export type Rules = {
  landholder?: boolean; notIncomeTaxPayer?: boolean; farmer?: boolean; karnataka?: boolean; minAge?: number; maxAge?: number;
  smallMarginal?: boolean; waterSource?: boolean; crop?: string; notifiedCrop?: boolean;
};

export interface Relevance { verdict: "fits_basics" | "does_not_fit" | "need_info"; reasons: string[]; missing: string[] }

const SMALL_MARGINAL_ACRES = 4.942; // 2 hectares — the standard definition of small & marginal holdings

export function checkRelevance(rules: Rules | null | undefined, a: SchemeAnswers, schemeCrops: string[] = []): Relevance {
  const r = rules ?? {};
  const reasons: string[] = [];
  const missing: string[] = [];
  let fail = false;
  const need = (cond: boolean | null | undefined, ok: string, bad: string, ask: string) => {
    if (cond === null || cond === undefined) missing.push(ask);
    else if (cond) reasons.push(ok);
    else { fail = true; reasons.push(bad); }
  };
  if (r.landholder) need(a.ownsLand, "You own cultivable land", "Requires land in your name", "Do you own land in your name?");
  if (r.notIncomeTaxPayer) need(a.incomeTaxPayer == null ? null : !a.incomeTaxPayer, "Not an income-tax payer", "Income-tax payers are excluded", "Do you pay income tax?");
  if (r.karnataka) need(a.inKarnataka, "Farming in Karnataka", "Only for Karnataka farmers", "Is your farm in Karnataka?");
  if (r.waterSource) need(a.hasWaterSource, "You have a water source", "Needs a water source (well, borewell, tank…)", "Do you have a water source?");
  if (r.minAge != null || r.maxAge != null) {
    if (a.age == null) missing.push("Your age");
    else if ((r.minAge != null && a.age < r.minAge) || (r.maxAge != null && a.age > r.maxAge)) { fail = true; reasons.push(`Entry age is ${r.minAge ?? 0}–${r.maxAge ?? "any"} years`); }
    else reasons.push(`Age ${a.age} is within ${r.minAge ?? 0}–${r.maxAge} years`);
  }
  if (r.smallMarginal) {
    if (a.landAcres == null) missing.push("Your total land (acres)");
    else if (a.landAcres > SMALL_MARGINAL_ACRES) { fail = true; reasons.push("For small & marginal farmers (up to 2 hectares ≈ 4.94 acres)"); }
    else reasons.push("Land within small & marginal limit (2 ha)");
  }
  if (r.crop) {
    if (!a.crops?.length) missing.push("Your crops");
    else if (a.crops.includes(r.crop)) reasons.push(`You grow ${r.crop}`);
    else { fail = true; reasons.push(`Only for ${r.crop} growers`); }
  }
  if ((r.notifiedCrop || schemeCrops.length) && a.crops?.length && schemeCrops.length) {
    const overlap = a.crops.filter((c) => schemeCrops.includes(c));
    if (overlap.length) reasons.push(`Relevant to your crops: ${overlap.join(", ")}`);
    else if (r.notifiedCrop) reasons.push("Your crops may not be notified — check the current notification");
  }
  return { verdict: fail ? "does_not_fit" : missing.length ? "need_info" : "fits_basics", reasons, missing };
}
