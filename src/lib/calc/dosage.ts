// Application calculator. It never supplies a dose by itself: every calculation starts from a dose that the
// farmer enters from a verified source (product label, KVK / university package of practices, agri officer).
import { AreaUnit, QuantityUnit, convertArea, convertQuantity, humanizeQuantity, round, unitDimension } from "../units";

export type DoseBasis =
  | { kind: "per_area"; area: number; areaUnit: AreaUnit } // e.g. 50 kg per 1 ACRE
  | { kind: "per_litre"; litres: number } // e.g. 2 ml per 1 litre of water (spray concentration)
  | { kind: "per_plant"; plants: number }; // e.g. 500 g per 1 palm

export interface DosageInput {
  dose: number;
  doseUnit: QuantityUnit;
  basis: DoseBasis;
  // target
  targetArea?: number;
  targetAreaUnit?: AreaUnit;
  sprayVolumePerArea?: { litres: number; area: number; areaUnit: AreaUnit }; // water used per area (e.g. 200 L per acre)
  waterLitres?: number; // total water available/planned (for per_litre basis)
  plantCount?: number;
  // optional
  available?: { quantity: number; unit: QuantityUnit };
  price?: { amount: number; per: number; unit: QuantityUnit }; // ₹amount per `per` unit (e.g. ₹1200 per 50 kg)
}

export interface DosageResult {
  productQuantity: number;
  productUnit: QuantityUnit;
  display: { value: number; unit: QuantityUnit };
  waterLitres: number | null;
  costEstimate: number | null;
  shortfall: { value: number; unit: QuantityUnit } | null;
  steps: string[];
}

export function calculateDosage(input: DosageInput): DosageResult {
  if (!(input.dose > 0)) throw new Error("Dose must be greater than zero");
  const steps: string[] = [];
  let qty: number;
  let water: number | null = null;

  switch (input.basis.kind) {
    case "per_area": {
      if (!(input.targetArea! > 0) || !input.targetAreaUnit) throw new Error("Enter the area to be treated");
      if (!(input.basis.area > 0)) throw new Error("Dose area basis must be greater than zero");
      const ratio = convertArea(input.targetArea!, input.targetAreaUnit, input.basis.areaUnit) / input.basis.area;
      qty = input.dose * ratio;
      steps.push(
        `Area ${input.targetArea} ${input.targetAreaUnit.toLowerCase()} = ${round(ratio * input.basis.area, 4)} ${input.basis.areaUnit.toLowerCase()}`,
        `${input.dose} ${input.doseUnit} × ${round(ratio, 4)} = ${round(qty, 3)} ${input.doseUnit}`,
      );
      if (input.sprayVolumePerArea && input.sprayVolumePerArea.area > 0) {
        const r2 = convertArea(input.targetArea!, input.targetAreaUnit, input.sprayVolumePerArea.areaUnit) / input.sprayVolumePerArea.area;
        water = input.sprayVolumePerArea.litres * r2;
        steps.push(`Water: ${input.sprayVolumePerArea.litres} L × ${round(r2, 4)} = ${round(water, 2)} L`);
      }
      break;
    }
    case "per_litre": {
      let litres = input.waterLitres;
      if (litres == null && input.sprayVolumePerArea && input.targetArea && input.targetAreaUnit) {
        const r2 = convertArea(input.targetArea, input.targetAreaUnit, input.sprayVolumePerArea.areaUnit) / input.sprayVolumePerArea.area;
        litres = input.sprayVolumePerArea.litres * r2;
        steps.push(`Spray water needed: ${input.sprayVolumePerArea.litres} L × ${round(r2, 4)} = ${round(litres, 2)} L`);
      }
      if (!(litres! > 0)) throw new Error("Enter the total water quantity (litres) or spray volume per area");
      if (!(input.basis.litres > 0)) throw new Error("Litre basis must be greater than zero");
      qty = (input.dose / input.basis.litres) * litres!;
      water = litres!;
      steps.push(`${input.dose} ${input.doseUnit} per ${input.basis.litres} L × ${round(litres!, 2)} L = ${round(qty, 3)} ${input.doseUnit}`);
      break;
    }
    case "per_plant": {
      if (!(input.plantCount! > 0)) throw new Error("Enter the number of plants");
      if (!(input.basis.plants > 0)) throw new Error("Plant basis must be greater than zero");
      qty = (input.dose / input.basis.plants) * input.plantCount!;
      steps.push(`${input.dose} ${input.doseUnit} per ${input.basis.plants} plant(s) × ${input.plantCount} = ${round(qty, 3)} ${input.doseUnit}`);
      break;
    }
  }

  let cost: number | null = null;
  if (input.price && input.price.per > 0) {
    if (unitDimension(input.price.unit) !== unitDimension(input.doseUnit)) throw new Error("Price unit must be the same kind (weight/volume) as the dose");
    const qtyInPriceUnit = convertQuantity(qty, input.doseUnit, input.price.unit);
    cost = round((qtyInPriceUnit / input.price.per) * input.price.amount, 2);
    steps.push(`Cost: ${round(qtyInPriceUnit, 3)} ${input.price.unit} × ₹${input.price.amount}/${input.price.per} ${input.price.unit} = ₹${cost}`);
  }

  let shortfall: DosageResult["shortfall"] = null;
  if (input.available) {
    if (unitDimension(input.available.unit) !== unitDimension(input.doseUnit)) throw new Error("Available stock unit must be the same kind (weight/volume) as the dose");
    const avail = convertQuantity(input.available.quantity, input.available.unit, input.doseUnit);
    if (avail < qty) shortfall = humanizeQuantity(qty - avail, input.doseUnit);
  }

  const h = humanizeQuantity(qty, input.doseUnit);
  return {
    productQuantity: round(qty, 4),
    productUnit: input.doseUnit,
    display: { value: round(h.value, 3), unit: h.unit },
    waterLitres: water == null ? null : round(water, 2),
    costEstimate: cost,
    shortfall: shortfall ? { value: round(shortfall.value, 3), unit: shortfall.unit } : null,
    steps,
  };
}
