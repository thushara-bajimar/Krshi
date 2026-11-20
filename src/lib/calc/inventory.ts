export type InventoryTxnType = "PURCHASE" | "USAGE" | "WASTAGE" | "ADJUSTMENT";

/** Signed stock change for a transaction. ADJUSTMENT sets stock to an absolute counted value. */
export function stockDelta(type: InventoryTxnType, quantity: number, currentStock: number): number {
  if (quantity < 0) throw new Error("Quantity cannot be negative");
  switch (type) {
    case "PURCHASE":
      return quantity;
    case "USAGE":
    case "WASTAGE":
      if (quantity > currentStock + 1e-9) throw new Error(`Only ${currentStock} in stock — cannot remove ${quantity}`);
      return -quantity;
    case "ADJUSTMENT":
      return quantity - currentStock;
  }
}

export function isLowStock(quantity: number, threshold: number | null | undefined) {
  return threshold != null && quantity <= threshold;
}

export function daysUntil(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}
