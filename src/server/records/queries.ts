import "server-only";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { checkReadAccess } from "./service";
import type { EntityName } from "./registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
const LIMIT = 300;

export async function listRecords(userId: string, entity: EntityName, farmId: string, params: URLSearchParams) {
  await checkReadAccess(userId, entity, farmId);
  const since = params.get("since") ? new Date(params.get("since")!) : undefined;
  const upd = since ? { updatedAt: { gt: since } } : {};
  const live = since ? {} : { deletedAt: null }; // delta sync includes tombstones
  const q: Record<EntityName, () => Promise<any[]>> = {
    plot: () => prisma.plot.findMany({ where: { farmId, ...upd }, include: { crop: true }, orderBy: { name: "asc" } }),
    activity: () => prisma.activity.findMany({ where: { farmId, ...upd, ...live }, include: { plot: { select: { name: true } }, crop: { select: { name: true } } }, orderBy: { date: "desc" }, take: LIMIT }),
    worker: () => prisma.worker.findMany({ where: { farmId, ...upd }, orderBy: { name: "asc" } }),
    labor: () => prisma.laborRecord.findMany({ where: { farmId, ...upd, ...live }, include: { worker: { select: { name: true } } }, orderBy: { date: "desc" }, take: LIMIT }),
    laborPayment: () => prisma.laborPayment.findMany({ where: { laborRecord: { farmId } }, orderBy: { date: "desc" }, take: LIMIT }),
    expense: () => prisma.expense.findMany({ where: { farmId, ...upd, ...live }, orderBy: { date: "desc" }, take: LIMIT }),
    income: () => prisma.income.findMany({ where: { farmId, ...upd, ...live }, orderBy: { date: "desc" }, take: LIMIT }),
    harvest: () => prisma.harvest.findMany({ where: { farmId, ...upd, ...live }, orderBy: { date: "desc" }, take: LIMIT }),
    inventoryItem: () => prisma.inventoryItem.findMany({ where: { farmId, ...upd, ...live }, orderBy: { name: "asc" } }),
    inventoryTxn: () => prisma.inventoryTransaction.findMany({ where: { item: { farmId } }, orderBy: { date: "desc" }, take: LIMIT }),
    task: () => prisma.task.findMany({ where: { farmId, ...upd, ...live }, orderBy: { date: "asc" }, take: LIMIT }),
    soilTest: () => prisma.soilTest.findMany({ where: { farmId, ...upd }, orderBy: { testDate: "desc" } }),
    equipment: () => prisma.equipment.findMany({ where: { farmId, ...upd }, orderBy: { name: "asc" } }),
    equipmentLog: () => prisma.equipmentLog.findMany({ where: { equipment: { farmId } }, orderBy: { date: "desc" }, take: LIMIT }),
    cropIssue: () => prisma.cropIssue.findMany({ where: { farmId, ...upd }, orderBy: { createdAt: "desc" } }),
  };
  return serialize(await q[entity]());
}
