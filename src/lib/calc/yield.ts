import { AreaUnit, convertArea, round } from "../units";

export function yieldPerArea(quantity: number, area: number, areaUnit: AreaUnit, per: AreaUnit = "ACRE"): number | null {
  if (!(area > 0)) return null;
  return round(quantity / convertArea(area, areaUnit, per), 3);
}

export function harvestRemaining(harvested: number, sold: number): number {
  return round(Math.max(0, harvested - sold), 3);
}

/** Cost per unit of produce = total cost / harvested quantity (null when nothing harvested). */
export function costPerUnit(totalCost: number, harvested: number): number | null {
  return harvested > 0 ? round(totalCost / harvested, 2) : null;
}
