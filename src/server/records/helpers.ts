import "server-only";
import type { Prisma } from "@prisma/client";
import { badRequest } from "@/lib/errors";

export type Tx = Prisma.TransactionClient;

/** "YYYY-MM-DD" -> Date at UTC midnight (matches Postgres DATE semantics). */
export const toDate = (s: string | undefined | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
export const toDateReq = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Remove keys whose value is undefined so Prisma leaves them untouched; convert to null when clearing is intended. */
export function nullify<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
  const out = { ...obj };
  for (const k of keys) if (out[k] === undefined) (out as Record<string, unknown>)[k as string] = null;
  return out;
}

// --- Cross-farm reference guards. Every foreign id coming from a client must belong to the same farm.
export async function assertPlot(tx: Tx, plotId: string | undefined | null, farmId: string) {
  if (!plotId) return;
  const p = await tx.plot.findFirst({ where: { id: plotId, farmId }, select: { id: true } });
  if (!p) throw badRequest("Selected plot does not belong to this farm");
}
export async function assertWorkers(tx: Tx, workerIds: string[], farmId: string) {
  if (!workerIds.length) return;
  const n = await tx.worker.count({ where: { id: { in: workerIds }, farmId } });
  if (n !== new Set(workerIds).size) throw badRequest("One or more workers do not belong to this farm");
}
export async function assertCrop(tx: Tx, cropId: string | undefined | null) {
  if (!cropId) return;
  const c = await tx.crop.findUnique({ where: { id: cropId }, select: { id: true } });
  if (!c) throw badRequest("Unknown crop");
}
export async function assertActivity(tx: Tx, activityId: string | undefined | null, farmId: string) {
  if (!activityId) return;
  const a = await tx.activity.findFirst({ where: { id: activityId, farmId, deletedAt: null }, select: { id: true } });
  if (!a) throw badRequest("Linked activity not found on this farm");
}
export async function assertTask(tx: Tx, taskId: string | undefined | null, farmId: string) {
  if (!taskId) return;
  const t = await tx.task.findFirst({ where: { id: taskId, farmId, deletedAt: null }, select: { id: true } });
  if (!t) throw badRequest("Linked task not found on this farm");
}

/** If plot given and crop not, inherit the plot's crop. */
export async function inheritCrop(tx: Tx, plotId?: string | null, cropId?: string | null) {
  if (cropId || !plotId) return cropId ?? null;
  const p = await tx.plot.findUnique({ where: { id: plotId }, select: { cropId: true } });
  return p?.cropId ?? null;
}

export const ACTIVITY_TO_EXPENSE: Record<string, string> = {
  FERTILIZER: "FERTILIZER",
  PESTICIDE: "PESTICIDE",
  FUNGICIDE: "PESTICIDE",
  HERBICIDE: "PESTICIDE",
  PEST_MANAGEMENT: "PESTICIDE",
  DISEASE_MANAGEMENT: "PESTICIDE",
  IRRIGATION: "IRRIGATION",
  PLANTING: "SEEDS",
  EQUIPMENT_USAGE: "MACHINERY",
};

export const INVENTORY_TO_EXPENSE: Record<string, string> = {
  FERTILIZER: "FERTILIZER",
  PESTICIDE: "PESTICIDE",
  SEEDS: "SEEDS",
  TOOLS: "EQUIPMENT",
  EQUIPMENT: "EQUIPMENT",
  IRRIGATION: "IRRIGATION",
  OTHER: "OTHER",
};
