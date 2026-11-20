import "server-only";
import { Prisma, type ExpenseCategory, type InventoryTxnType } from "@prisma/client";
import type { ZodTypeAny } from "zod";
import * as S from "@/lib/validation/schemas";
import { badRequest, conflict } from "@/lib/errors";
import { laborTotal, paymentStatus } from "@/lib/calc/labor";
import { saleAmounts } from "@/lib/calc/finance";
import { stockDelta } from "@/lib/calc/inventory";
import { sumMoney } from "@/lib/calc/money";
import type { Permission } from "@/lib/authz";
import {
  ACTIVITY_TO_EXPENSE,
  INVENTORY_TO_EXPENSE,
  assertActivity,
  assertCrop,
  assertPlot,
  assertTask,
  assertWorkers,
  inheritCrop,
  toDate,
  toDateReq,
  type Tx,
} from "./helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Ctx {
  tx: Tx;
  userId: string;
  can: (p: Permission) => boolean;
}

export interface Loaded {
  farmId: string;
  version?: number;
  deleted?: boolean;
  record: any;
}

export interface EntityDef {
  /** finance-sensitive records need finance:read / finance:write instead of read / write */
  sensitive: boolean;
  createSchema: ZodTypeAny;
  updateSchema?: ZodTypeAny;
  /** farm the new record belongs to (may require a lookup, e.g. payment -> labour record) */
  farmIdFor(tx: Tx, data: any): Promise<string>;
  load(tx: Tx, id: string): Promise<Loaded | null>;
  create(ctx: Ctx, data: any, farmId: string): Promise<any>;
  update?(ctx: Ctx, existing: Loaded, data: any): Promise<any>;
  remove(ctx: Ctx, existing: Loaded): Promise<void>;
}

const direct = (_tx: Tx, data: { farmId: string }) => Promise.resolve(data.farmId);

async function recordInventoryTxn(
  ctx: Ctx,
  args: { itemId: string; farmId: string; type: InventoryTxnType; quantity: number; date: string; unitCost?: number; supplier?: string; notes?: string; activityId?: string; recordExpense?: boolean; id?: string },
) {
  const item = await ctx.tx.inventoryItem.findFirst({ where: { id: args.itemId, farmId: args.farmId, deletedAt: null } });
  if (!item) throw badRequest("Inventory item not found on this farm");
  const current = Number(item.quantity);
  const delta = stockDelta(args.type, args.quantity, current);
  const totalCost = args.unitCost != null ? Math.round(args.unitCost * args.quantity * 100) / 100 : null;
  let expenseId: string | null = null;
  if (args.recordExpense && args.type === "PURCHASE" && totalCost && totalCost > 0) {
    if (!ctx.can("finance:write")) throw badRequest("Your role cannot record expenses");
    const exp = await ctx.tx.expense.create({
      data: {
        farmId: args.farmId,
        category: (INVENTORY_TO_EXPENSE[item.category] ?? "OTHER") as ExpenseCategory,
        amount: totalCost,
        date: toDateReq(args.date),
        description: `Purchase: ${args.quantity} ${item.unit} ${item.name}`,
        vendor: args.supplier,
        createdById: ctx.userId,
      },
    });
    expenseId = exp.id;
  }
  // conditional update guards against concurrent deductions driving stock negative
  const updated = await ctx.tx.inventoryItem.updateMany({
    where: { id: item.id, quantity: item.quantity },
    data: { quantity: { increment: delta }, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw conflict("Stock changed while saving — please retry");
  return ctx.tx.inventoryTransaction.create({
    data: {
      id: args.id,
      itemId: item.id,
      type: args.type,
      quantity: args.quantity,
      delta,
      unitCost: args.unitCost,
      totalCost,
      date: toDateReq(args.date),
      supplier: args.supplier,
      notes: args.notes,
      activityId: args.activityId,
      expenseId,
      createdById: ctx.userId,
    },
  });
}

async function refreshLaborPayment(tx: Tx, laborRecordId: string) {
  const rec = await tx.laborRecord.findUniqueOrThrow({ where: { id: laborRecordId }, include: { payments: true } });
  const paid = sumMoney(rec.payments.map((p) => Number(p.amount)));
  await tx.laborRecord.update({
    where: { id: laborRecordId },
    data: { amountPaid: paid, paymentStatus: paymentStatus(Number(rec.totalCost), paid), version: { increment: 1 } },
  });
}

// ------------------------------------------------------------------------------------------------ entities

const plot: EntityDef = {
  sensitive: false,
  createSchema: S.plotSchema,
  updateSchema: S.plotSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.plot.findUnique({ where: { id } });
    return r && { farmId: r.farmId, record: r };
  },
  async create({ tx }, d, farmId) {
    await assertCrop(tx, d.cropId);
    return tx.plot.create({ data: { ...d, farmId, plantingDate: toDate(d.plantingDate) } });
  },
  async update({ tx }, ex, d) {
    await assertCrop(tx, d.cropId);
    const { farmId: _f, id: _i, ...rest } = d;
    return tx.plot.update({
      where: { id: ex.record.id },
      data: { ...rest, cropId: rest.cropId ?? null, plantingDate: toDate(rest.plantingDate), latitude: rest.latitude ?? null, longitude: rest.longitude ?? null },
    });
  },
  async remove({ tx }, ex) {
    await tx.plot.delete({ where: { id: ex.record.id } });
  },
};

const activity: EntityDef = {
  sensitive: false,
  createSchema: S.activitySchema,
  updateSchema: S.activitySchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.activity.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create(ctx, d, farmId) {
    const { tx } = ctx;
    await assertPlot(tx, d.plotId, farmId);
    await assertCrop(tx, d.cropId);
    const { recordExpense, inventoryItemId, inventoryQuantity, ...data } = d;
    const cropId = await inheritCrop(tx, d.plotId, d.cropId);
    const act = await tx.activity.create({
      data: { ...data, farmId, cropId, date: toDateReq(d.date), followUpDate: toDate(d.followUpDate), createdById: ctx.userId },
    });
    if (inventoryItemId && inventoryQuantity > 0) {
      await recordInventoryTxn(ctx, {
        itemId: inventoryItemId, farmId, type: "USAGE", quantity: inventoryQuantity, date: d.date, activityId: act.id,
        notes: `Used in activity: ${d.type.toLowerCase().replace("_", " ")}${d.productName ? ` (${d.productName})` : ""}`,
      });
    }
    if (recordExpense && d.cost > 0) {
      if (!ctx.can("finance:write")) throw badRequest("Your role cannot record expenses");
      await tx.expense.create({
        data: {
          farmId, plotId: d.plotId, cropId, activityId: act.id,
          category: (ACTIVITY_TO_EXPENSE[d.type] ?? "OTHER") as ExpenseCategory,
          amount: d.cost, date: toDateReq(d.date),
          description: `${d.productName ?? d.type.toLowerCase().replace("_", " ")} — from activity diary`,
          createdById: ctx.userId,
        },
      });
    }
    return act;
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    await assertCrop(tx, d.cropId);
    const { farmId: _f, id: _i, recordExpense: _r, inventoryItemId: _ii, inventoryQuantity: _iq, ...data } = d;
    const fields = ["plotId", "cropId", "description", "productName", "productCategory", "quantity", "quantityUnit", "areaCovered", "areaUnit", "dilution", "waterQuantity", "waterUnit", "cost", "laborDetails", "notes", "sourceReference"];
    const clean: Record<string, unknown> = {};
    for (const f of fields) clean[f] = data[f] ?? null;
    return tx.activity.update({
      where: { id: ex.record.id },
      data: { ...clean, type: data.type, date: toDateReq(data.date), followUpDate: toDate(data.followUpDate), version: { increment: 1 } },
    });
  },
  async remove({ tx, userId }, ex) {
    // reverse any stock deducted by this activity so inventory stays consistent
    const txns = await tx.inventoryTransaction.findMany({ where: { activityId: ex.record.id, type: "USAGE" } });
    for (const t of txns) {
      await tx.inventoryItem.update({ where: { id: t.itemId }, data: { quantity: { increment: t.quantity }, version: { increment: 1 } } });
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: t.itemId } });
      await tx.inventoryTransaction.create({
        data: { itemId: t.itemId, type: "ADJUSTMENT", quantity: item.quantity, delta: t.quantity, date: new Date(), notes: "Returned to stock: linked activity deleted", createdById: userId },
      });
    }
    await tx.activity.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

const worker: EntityDef = {
  sensitive: false,
  createSchema: S.workerSchema,
  updateSchema: S.workerSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.worker.findUnique({ where: { id } });
    return r && { farmId: r.farmId, record: r };
  },
  create: ({ tx }, d, farmId) => tx.worker.create({ data: { ...d, farmId } }),
  async update({ tx }, ex, d) {
    const { farmId: _f, id: _i, ...rest } = d;
    return tx.worker.update({ where: { id: ex.record.id }, data: { ...rest, phone: rest.phone ?? null, defaultWage: rest.defaultWage ?? null, notes: rest.notes ?? null } });
  },
  async remove({ tx }, ex) {
    const n = await tx.laborRecord.count({ where: { workerId: ex.record.id, deletedAt: null } });
    if (n > 0) throw conflict(`This worker has ${n} work record(s). Mark them inactive instead so payment history is kept.`);
    await tx.worker.delete({ where: { id: ex.record.id } });
  },
};

const labor: EntityDef = {
  sensitive: true,
  createSchema: S.laborSchema,
  updateSchema: S.laborUpdateSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.laborRecord.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create(ctx, d, farmId) {
    const { tx } = ctx;
    await assertPlot(tx, d.plotId, farmId);
    await assertWorkers(tx, d.workerIds, farmId);
    await assertActivity(tx, d.activityId, farmId);
    await assertTask(tx, d.taskId, farmId);
    const perRecordWorkers = d.workerIds.length ? 1 : d.workerCount;
    const computed = laborTotal({ workerCount: perRecordWorkers, units: d.units, rate: d.rate, additionalCost: d.workerIds.length > 1 ? 0 : d.additionalCost ?? 0 });
    const targets: Array<{ workerId: string | null }> = d.workerIds.length ? d.workerIds.map((w: string) => ({ workerId: w })) : [{ workerId: null }];
    const created = [];
    for (let i = 0; i < targets.length; i++) {
      // a manual total override only makes sense for a single record
      const total = targets.length === 1 && d.totalOverride != null ? d.totalOverride : computed;
      // additional cost for a multi-worker entry is attached to the first record only
      const extra = targets.length > 1 && i === 0 ? d.additionalCost ?? 0 : 0;
      const finalTotal = Math.round((total + extra) * 100) / 100;
      const paid = targets.length === 1 ? Math.min(d.amountPaid ?? 0, finalTotal) : 0;
      const rec = await tx.laborRecord.create({
        data: {
          id: i === 0 ? d.id : undefined,
          farmId, plotId: d.plotId, workerId: targets[i].workerId, workerLabel: d.workerLabel,
          workerCount: perRecordWorkers, taskCategory: d.taskCategory, description: d.description,
          date: toDateReq(d.date), wageType: d.wageType, units: d.units, rate: d.rate,
          additionalCost: targets.length > 1 ? extra : d.additionalCost ?? 0, totalCost: finalTotal,
          amountPaid: paid, paymentStatus: paymentStatus(finalTotal, paid), workStatus: d.workStatus,
          notes: d.notes, activityId: d.activityId, taskId: d.taskId, createdById: ctx.userId,
        },
      });
      if (paid > 0) {
        await tx.laborPayment.create({ data: { laborRecordId: rec.id, amount: paid, date: toDateReq(d.paymentDate ?? d.date) } });
      }
      created.push(rec);
    }
    // When several workers were paid together, record payment per worker if a full amount was given
    if (targets.length > 1 && d.amountPaid && d.amountPaid > 0) {
      const sumTotal = sumMoney(created.map((c) => Number(c.totalCost)));
      if (Math.abs(d.amountPaid - sumTotal) < 0.005) {
        for (const c of created) {
          await tx.laborPayment.create({ data: { laborRecordId: c.id, amount: c.totalCost, date: toDateReq(d.paymentDate ?? d.date) } });
          await tx.laborRecord.update({ where: { id: c.id }, data: { amountPaid: c.totalCost, paymentStatus: "PAID" } });
        }
      } else {
        throw badRequest("For several workers, either leave 'amount paid' empty and record payments per worker, or enter the full total");
      }
    }
    return created.length === 1 ? created[0] : { records: created, count: created.length };
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    const computed = laborTotal({ workerCount: d.workerCount, units: d.units, rate: d.rate, additionalCost: d.additionalCost ?? 0 });
    const total = d.totalOverride ?? computed;
    const paid = Number(ex.record.amountPaid);
    if (paid > total + 0.005) throw badRequest(`Already paid ₹${paid}; the total cannot be less than that`);
    return tx.laborRecord.update({
      where: { id: ex.record.id },
      data: {
        plotId: d.plotId ?? null, taskCategory: d.taskCategory, description: d.description ?? null, date: toDateReq(d.date),
        wageType: d.wageType, workerCount: d.workerCount, units: d.units, rate: d.rate, additionalCost: d.additionalCost ?? 0,
        totalCost: total, paymentStatus: paymentStatus(total, paid), workStatus: d.workStatus, notes: d.notes ?? null,
        version: { increment: 1 },
      },
    });
  },
  async remove({ tx }, ex) {
    await tx.laborRecord.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

const laborPayment: EntityDef = {
  sensitive: true,
  createSchema: S.laborPaymentSchema,
  async farmIdFor(tx, d) {
    const r = await tx.laborRecord.findUnique({ where: { id: d.laborRecordId }, select: { farmId: true, deletedAt: true } });
    if (!r || r.deletedAt) throw badRequest("Work record not found");
    return r.farmId;
  },
  async load(tx, id) {
    const r = await tx.laborPayment.findUnique({ where: { id }, include: { laborRecord: { select: { farmId: true } } } });
    return r && { farmId: r.laborRecord.farmId, record: r };
  },
  async create({ tx }, d) {
    const rec = await tx.laborRecord.findUniqueOrThrow({ where: { id: d.laborRecordId } });
    const pending = Number(rec.totalCost) - Number(rec.amountPaid);
    if (d.amount > pending + 0.005) throw badRequest(`Only ₹${pending.toFixed(2)} is pending for this record`);
    const p = await tx.laborPayment.create({ data: { ...d, date: toDateReq(d.date) } });
    await refreshLaborPayment(tx, d.laborRecordId);
    return p;
  },
  async remove({ tx }, ex) {
    await tx.laborPayment.delete({ where: { id: ex.record.id } });
    await refreshLaborPayment(tx, ex.record.laborRecordId);
  },
};

const expense: EntityDef = {
  sensitive: true,
  createSchema: S.expenseSchema,
  updateSchema: S.expenseSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.expense.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create({ tx, userId }, d, farmId) {
    await assertPlot(tx, d.plotId, farmId);
    await assertCrop(tx, d.cropId);
    await assertActivity(tx, d.activityId, farmId);
    const cropId = await inheritCrop(tx, d.plotId, d.cropId);
    return tx.expense.create({ data: { ...d, farmId, cropId, date: toDateReq(d.date), createdById: userId } });
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    await assertCrop(tx, d.cropId);
    return tx.expense.update({
      where: { id: ex.record.id },
      data: {
        plotId: d.plotId ?? null, cropId: d.cropId ?? null, category: d.category, amount: d.amount, date: toDateReq(d.date),
        description: d.description ?? null, paymentMethod: d.paymentMethod ?? null, vendor: d.vendor ?? null, version: { increment: 1 },
      },
    });
  },
  async remove({ tx }, ex) {
    await tx.expense.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

async function checkHarvestLink(tx: Tx, d: any, farmId: string, excludeIncomeId?: string) {
  if (!d.harvestId) return;
  const h = await tx.harvest.findFirst({ where: { id: d.harvestId, farmId, deletedAt: null }, include: { sales: { where: { deletedAt: null } } } });
  if (!h) throw badRequest("Linked harvest not found on this farm");
  if (d.quantity != null) {
    if (d.unit && d.unit !== h.unit) throw badRequest(`Sale unit must match the harvest unit (${h.unit})`);
    const sold = h.sales.filter((s) => s.id !== excludeIncomeId).reduce((a, s) => a + Number(s.quantity ?? 0), 0);
    const remaining = Number(h.quantity) - sold;
    if (d.quantity > remaining + 1e-6) throw badRequest(`Only ${remaining} ${h.unit} of this harvest is unsold`);
  }
  return h;
}

function incomeData(d: any) {
  const { grossAmount, netAmount } = saleAmounts(d);
  const received = d.amountReceived ?? netAmount;
  return {
    grossAmount, netAmount, amountReceived: received,
    paymentStatus: paymentStatus(netAmount, received),
  };
}

const income: EntityDef = {
  sensitive: true,
  createSchema: S.incomeSchema,
  updateSchema: S.incomeSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.income.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create({ tx, userId }, d, farmId) {
    await assertPlot(tx, d.plotId, farmId);
    await assertCrop(tx, d.cropId);
    const h = await checkHarvestLink(tx, d, farmId);
    const cropId = h?.cropId ?? (await inheritCrop(tx, d.plotId, d.cropId));
    return tx.income.create({
      data: { ...d, ...incomeData(d), farmId, cropId, unit: d.unit ?? h?.unit, date: toDateReq(d.date), createdById: userId },
    });
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    await checkHarvestLink(tx, d, ex.farmId, ex.record.id);
    const { id: _i, farmId: _f, ...rest } = d;
    const fields = ["plotId", "cropId", "harvestId", "description", "quantity", "unit", "pricePerUnit", "buyer", "market", "notes"];
    const clean: Record<string, unknown> = {};
    for (const f of fields) clean[f] = rest[f] ?? null;
    return tx.income.update({
      where: { id: ex.record.id },
      data: { ...clean, source: rest.source, transportCost: rest.transportCost ?? 0, otherDeductions: rest.otherDeductions ?? 0, ...incomeData(rest), date: toDateReq(rest.date), version: { increment: 1 } },
    });
  },
  async remove({ tx }, ex) {
    await tx.income.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

const harvest: EntityDef = {
  sensitive: false,
  createSchema: S.harvestSchema,
  updateSchema: S.harvestSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.harvest.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create({ tx, userId }, d, farmId) {
    await assertPlot(tx, d.plotId, farmId);
    await assertCrop(tx, d.cropId);
    return tx.harvest.create({ data: { ...d, farmId, date: toDateReq(d.date), createdById: userId } });
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    const sold = await tx.income.aggregate({ where: { harvestId: ex.record.id, deletedAt: null }, _sum: { quantity: true } });
    const soldQty = Number(sold._sum.quantity ?? 0);
    if (soldQty > 0 && d.unit !== ex.record.unit) throw badRequest("Unit cannot change after sales are linked to this harvest");
    if (d.quantity < soldQty) throw badRequest(`${soldQty} ${ex.record.unit} is already recorded as sold`);
    return tx.harvest.update({
      where: { id: ex.record.id },
      data: { plotId: d.plotId ?? null, cropId: d.cropId, date: toDateReq(d.date), quantity: d.quantity, unit: d.unit, grade: d.grade ?? null, storage: d.storage ?? null, notes: d.notes ?? null, version: { increment: 1 } },
    });
  },
  async remove({ tx }, ex) {
    await tx.harvest.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

const inventoryItem: EntityDef = {
  sensitive: false,
  createSchema: S.inventoryItemSchema,
  updateSchema: S.inventoryItemSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.inventoryItem.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create(ctx, d, farmId) {
    const { openingQuantity, openingUnitCost, recordExpense, ...data } = d;
    const item = await ctx.tx.inventoryItem.create({ data: { ...data, farmId, expiryDate: toDate(d.expiryDate) } });
    if (openingQuantity > 0) {
      await recordInventoryTxn(ctx, {
        itemId: item.id, farmId, type: "PURCHASE", quantity: openingQuantity, unitCost: openingUnitCost,
        date: new Date().toISOString().slice(0, 10), supplier: d.supplier, notes: "Opening stock", recordExpense,
      });
    }
    return ctx.tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  },
  async update({ tx }, ex, d) {
    return tx.inventoryItem.update({
      where: { id: ex.record.id },
      data: {
        name: d.name, category: d.category, unit: d.unit, lowStockThreshold: d.lowStockThreshold ?? null,
        expiryDate: toDate(d.expiryDate), supplier: d.supplier ?? null, storageNotes: d.storageNotes ?? null, version: { increment: 1 },
      },
    });
  },
  async remove({ tx }, ex) {
    await tx.inventoryItem.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

const inventoryTxn: EntityDef = {
  sensitive: false,
  createSchema: S.inventoryTxnSchema,
  async farmIdFor(tx, d) {
    const r = await tx.inventoryItem.findUnique({ where: { id: d.itemId }, select: { farmId: true } });
    if (!r) throw badRequest("Inventory item not found");
    return r.farmId;
  },
  async load(tx, id) {
    const r = await tx.inventoryTransaction.findUnique({ where: { id }, include: { item: { select: { farmId: true } } } });
    return r && { farmId: r.item.farmId, record: r };
  },
  async create(ctx, d, farmId) {
    await assertActivity(ctx.tx, d.activityId, farmId);
    return recordInventoryTxn(ctx, { ...d, farmId });
  },
  async remove({ tx }, ex) {
    const t = ex.record;
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: t.itemId } });
    const after = Number(item.quantity) - Number(t.delta);
    if (after < -1e-9) throw conflict("Undoing this entry would make stock negative — record an adjustment instead");
    await tx.inventoryItem.update({ where: { id: t.itemId }, data: { quantity: { decrement: t.delta }, version: { increment: 1 } } });
    if (t.expenseId) await tx.expense.update({ where: { id: t.expenseId }, data: { deletedAt: new Date() } });
    await tx.inventoryTransaction.delete({ where: { id: t.id } });
  },
};

const task: EntityDef = {
  sensitive: false,
  createSchema: S.taskSchema,
  updateSchema: S.taskSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.task.findUnique({ where: { id } });
    return r && { farmId: r.farmId, version: r.version, deleted: !!r.deletedAt, record: r };
  },
  async create({ tx, userId }, d, farmId) {
    await assertPlot(tx, d.plotId, farmId);
    await assertWorkers(tx, d.workerIds, farmId);
    const { workerIds, ...data } = d;
    const cropId = await inheritCrop(tx, d.plotId, d.cropId);
    return tx.task.create({
      data: { ...data, farmId, cropId, date: toDateReq(d.date), createdById: userId, workers: { create: workerIds.map((w: string) => ({ workerId: w })) } },
    });
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    await assertWorkers(tx, d.workerIds, ex.farmId);
    await tx.taskWorker.deleteMany({ where: { taskId: ex.record.id } });
    return tx.task.update({
      where: { id: ex.record.id },
      data: {
        plotId: d.plotId ?? null, cropId: d.cropId ?? null, title: d.title, category: d.category, date: toDateReq(d.date), time: d.time ?? null,
        description: d.description ?? null, estimatedCost: d.estimatedCost ?? null, actualCost: d.actualCost ?? null, status: d.status,
        reminderDays: d.reminderDays ?? null, notes: d.notes ?? null, version: { increment: 1 },
        workers: { create: d.workerIds.map((w: string) => ({ workerId: w })) },
      },
    });
  },
  async remove({ tx }, ex) {
    await tx.task.update({ where: { id: ex.record.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  },
};

const soilTest: EntityDef = {
  sensitive: false,
  createSchema: S.soilTestSchema,
  updateSchema: S.soilTestSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.soilTest.findUnique({ where: { id } });
    return r && { farmId: r.farmId, record: r };
  },
  async create({ tx, userId }, d, farmId) {
    await assertPlot(tx, d.plotId, farmId);
    return tx.soilTest.create({ data: { ...d, micronutrients: d.micronutrients ?? Prisma.JsonNull, farmId, testDate: toDateReq(d.testDate), createdById: userId } });
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    const { id: _i, farmId: _f, ...rest } = d;
    const fields = ["plotId", "laboratory", "sampleId", "soilType", "ph", "ec", "organicCarbon", "nitrogen", "phosphorus", "potassium", "notes"];
    const clean: Record<string, unknown> = {};
    for (const f of fields) clean[f] = rest[f] ?? null;
    return tx.soilTest.update({ where: { id: ex.record.id }, data: { ...clean, micronutrients: rest.micronutrients ?? Prisma.JsonNull, testDate: toDateReq(rest.testDate) } });
  },
  async remove({ tx }, ex) {
    await tx.soilTest.delete({ where: { id: ex.record.id } });
  },
};

const equipment: EntityDef = {
  sensitive: false,
  createSchema: S.equipmentSchema,
  updateSchema: S.equipmentSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.equipment.findUnique({ where: { id } });
    return r && { farmId: r.farmId, record: r };
  },
  create: ({ tx }, d, farmId) => tx.equipment.create({ data: { ...d, farmId, purchaseDate: toDate(d.purchaseDate) } }),
  async update({ tx }, ex, d) {
    const { id: _i, farmId: _f, ...rest } = d;
    return tx.equipment.update({
      where: { id: ex.record.id },
      data: { ...rest, purchaseDate: toDate(rest.purchaseDate), purchaseCost: rest.purchaseCost ?? null, rentalInfo: rest.rentalInfo ?? null, notes: rest.notes ?? null },
    });
  },
  async remove({ tx }, ex) {
    await tx.equipment.delete({ where: { id: ex.record.id } });
  },
};

const equipmentLog: EntityDef = {
  sensitive: false,
  createSchema: S.equipmentLogSchema,
  async farmIdFor(tx, d) {
    const r = await tx.equipment.findUnique({ where: { id: d.equipmentId }, select: { farmId: true } });
    if (!r) throw badRequest("Equipment not found");
    return r.farmId;
  },
  async load(tx, id) {
    const r = await tx.equipmentLog.findUnique({ where: { id }, include: { equipment: { select: { farmId: true } } } });
    return r && { farmId: r.equipment.farmId, record: r };
  },
  async create(ctx, d, farmId) {
    const { recordExpense, ...data } = d;
    const log = await ctx.tx.equipmentLog.create({ data: { ...data, date: toDateReq(d.date), nextDueDate: toDate(d.nextDueDate) }, include: { equipment: true } });
    if (recordExpense && d.cost > 0) {
      if (!ctx.can("finance:write")) throw badRequest("Your role cannot record expenses");
      const cat = d.type === "RENTAL" ? "RENTAL" : d.type === "USAGE" ? "MACHINERY" : "MAINTENANCE";
      await ctx.tx.expense.create({
        data: { farmId, category: cat, amount: d.cost, date: toDateReq(d.date), description: `${log.equipment.name}: ${d.type.toLowerCase()}${d.description ? ` — ${d.description}` : ""}`, equipmentLogId: log.id, createdById: ctx.userId },
      });
    }
    if (d.type === "REPAIR") await ctx.tx.equipment.update({ where: { id: d.equipmentId }, data: { status: "WORKING" } });
    return log;
  },
  async remove({ tx }, ex) {
    await tx.expense.updateMany({ where: { equipmentLogId: ex.record.id }, data: { deletedAt: new Date(), equipmentLogId: null } });
    await tx.equipmentLog.delete({ where: { id: ex.record.id } });
  },
};

const cropIssue: EntityDef = {
  sensitive: false,
  createSchema: S.cropIssueSchema,
  updateSchema: S.cropIssueSchema,
  farmIdFor: direct,
  async load(tx, id) {
    const r = await tx.cropIssue.findUnique({ where: { id } });
    return r && { farmId: r.farmId, record: r };
  },
  async create({ tx, userId }, d, farmId) {
    await assertPlot(tx, d.plotId, farmId);
    await assertCrop(tx, d.cropId);
    const cropId = await inheritCrop(tx, d.plotId, d.cropId);
    return tx.cropIssue.create({ data: { ...d, farmId, cropId, startedOn: toDate(d.startedOn), createdById: userId } });
  },
  async update({ tx }, ex, d) {
    await assertPlot(tx, d.plotId, ex.farmId);
    const { id: _i, farmId: _f, ...rest } = d;
    const fields = ["plotId", "cropId", "affectedArea", "previousTreatments", "expertAdvice", "resolution"];
    const clean: Record<string, unknown> = {};
    for (const f of fields) clean[f] = rest[f] ?? null;
    return tx.cropIssue.update({
      where: { id: ex.record.id },
      data: { ...clean, title: rest.title, description: rest.description, symptoms: rest.symptoms, status: rest.status, startedOn: toDate(rest.startedOn) },
    });
  },
  async remove({ tx }, ex) {
    await tx.cropIssue.delete({ where: { id: ex.record.id } });
  },
};

export const ENTITIES = {
  plot, activity, worker, labor, laborPayment, expense, income, harvest, inventoryItem, inventoryTxn, task, soilTest, equipment, equipmentLog, cropIssue,
} satisfies Record<string, EntityDef>;

export type EntityName = keyof typeof ENTITIES;
export const isEntity = (n: string): n is EntityName => n in ENTITIES;
