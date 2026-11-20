// Unit conversion. All factors are exact definitions:
//   1 acre = 4046.8564224 m² (international acre), 1 hectare = 10 000 m²,
//   1 cent = 1/100 acre, 1 gunta = 1/40 acre (as used in Karnataka land records).
//   1 quintal = 100 kg, 1 tonne = 1000 kg.

export type AreaUnit = "ACRE" | "CENT" | "HECTARE" | "SQ_M" | "GUNTA";
export type MassUnit = "kg" | "g" | "quintal" | "tonne";
export type VolumeUnit = "l" | "ml";
export type QuantityUnit = MassUnit | VolumeUnit;

export const AREA_TO_SQM: Record<AreaUnit, number> = {
  ACRE: 4046.8564224,
  CENT: 40.468564224,
  GUNTA: 101.17141056,
  HECTARE: 10000,
  SQ_M: 1,
};

export const AREA_UNITS: AreaUnit[] = ["ACRE", "CENT", "GUNTA", "HECTARE", "SQ_M"];

const MASS_TO_G: Record<MassUnit, number> = { g: 1, kg: 1000, quintal: 100000, tonne: 1000000 };
const VOLUME_TO_ML: Record<VolumeUnit, number> = { ml: 1, l: 1000 };

export function isAreaUnit(u: string): u is AreaUnit {
  return u in AREA_TO_SQM;
}
export function isMassUnit(u: string): u is MassUnit {
  return u in MASS_TO_G;
}
export function isVolumeUnit(u: string): u is VolumeUnit {
  return u in VOLUME_TO_ML;
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  assertFinite(value);
  return (value * AREA_TO_SQM[from]) / AREA_TO_SQM[to];
}

export function unitDimension(u: string): "mass" | "volume" | null {
  if (isMassUnit(u)) return "mass";
  if (isVolumeUnit(u)) return "volume";
  return null;
}

/** Convert between mass units or between volume units. Throws on mass<->volume (density unknown). */
export function convertQuantity(value: number, from: QuantityUnit, to: QuantityUnit): number {
  assertFinite(value);
  if (isMassUnit(from) && isMassUnit(to)) return (value * MASS_TO_G[from]) / MASS_TO_G[to];
  if (isVolumeUnit(from) && isVolumeUnit(to)) return (value * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to];
  throw new Error(`Cannot convert ${from} to ${to}: different dimensions (density is product-specific)`);
}

/** Express a quantity in the most readable unit of its dimension (e.g. 2500 g -> 2.5 kg). */
export function humanizeQuantity(value: number, unit: QuantityUnit): { value: number; unit: QuantityUnit } {
  if (isMassUnit(unit)) {
    const g = convertQuantity(value, unit, "g");
    if (Math.abs(g) >= 1_000_000) return { value: g / 1_000_000, unit: "tonne" };
    if (Math.abs(g) >= 1000) return { value: g / 1000, unit: "kg" };
    return { value: g, unit: "g" };
  }
  const ml = convertQuantity(value, unit, "ml");
  if (Math.abs(ml) >= 1000) return { value: ml / 1000, unit: "l" };
  return { value: ml, unit: "ml" };
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

function assertFinite(v: number) {
  if (!Number.isFinite(v)) throw new Error("Value must be a finite number");
}
