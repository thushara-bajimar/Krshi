import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mutateRecord, checkReadAccess } from "@/server/records/service";
import { loadFinance } from "@/server/finance";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken, newSessionToken } from "@/lib/auth/tokens";

// Runs against TEST_DATABASE_URL (see vitest.config.ts). Each run creates its own users and farms.
const tag = randomUUID().slice(0, 8);
let owner: string, manager: string, viewer: string, finViewer: string, stranger: string;
let farmA: string, farmB: string, plotA: string, plotB: string, cropId: string, itemId: string;

beforeAll(async () => {
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}-${tag}@test.local`, name: n, passwordHash: "x" } }).then((u) => u.id);
  [owner, manager, viewer, finViewer, stranger] = await Promise.all(["owner", "manager", "viewer", "finviewer", "stranger"].map(mk));
  const crop = await prisma.crop.upsert({ where: { key: "arecanut" }, update: {}, create: { key: "arecanut", name: "Arecanut", category: "plantation", isSystem: true } });
  cropId = crop.id;
  farmA = (await prisma.farm.create({ data: { name: `A ${tag}`, district: "Udupi", memberships: { create: [{ userId: owner, role: "OWNER" }, { userId: manager, role: "MANAGER" }, { userId: viewer, role: "VIEWER" }, { userId: finViewer, role: "FINANCE_VIEWER" }] } } })).id;
  farmB = (await prisma.farm.create({ data: { name: `B ${tag}`, district: "Udupi", memberships: { create: [{ userId: stranger, role: "OWNER" }] } } })).id;
  plotA = (await prisma.plot.create({ data: { farmId: farmA, name: "Block A", area: 2, cropId } })).id;
  plotB = (await prisma.plot.create({ data: { farmId: farmB, name: "Other farm plot", area: 1 } })).id;
  const r = await mutateRecord({ userId: owner, entity: "inventoryItem", op: "create", payload: { farmId: farmA, name: "Copper sulphate", category: "PESTICIDE", unit: "kg", openingQuantity: 10, openingUnitCost: 240 } });
  itemId = (r.body as { record: { id: string } }).record.id;
});

afterAll(async () => {
  await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, manager, viewer, finViewer, stranger] } } });
  await prisma.$disconnect();
});

const today = "2026-11-20";

describe("activity diary with linked inventory and expense", () => {
  it("deducts stock and creates the expense in one transaction", async () => {
    const r = await mutateRecord({ userId: owner, entity: "activity", op: "create", payload: { farmId: farmA, plotId: plotA, type: "FUNGICIDE", date: today, productName: "Bordeaux", cost: "960", recordExpense: true, inventoryItemId: itemId, inventoryQuantity: "4" } });
    expect(r.status).toBe(201);
    const act = (r.body as { record: { id: string; cropId: string } }).record;
    expect(act.cropId).toBe(cropId); // inherited from plot
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantity)).toBe(6);
    const exp = await prisma.expense.findMany({ where: { activityId: act.id } });
    expect(exp).toHaveLength(1);
    expect(exp[0].category).toBe("PESTICIDE");
    expect(Number(exp[0].amount)).toBe(960);
  });

  it("rolls back everything when stock is insufficient", async () => {
    const before = await prisma.activity.count({ where: { farmId: farmA } });
    await expect(mutateRecord({ userId: owner, entity: "activity", op: "create", payload: { farmId: farmA, type: "FUNGICIDE", date: today, inventoryItemId: itemId, inventoryQuantity: "50", cost: "10", recordExpense: true } })).rejects.toThrow(/in stock/);
    expect(await prisma.activity.count({ where: { farmId: farmA } })).toBe(before);
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantity)).toBe(6);
  });

  it("deleting the activity returns stock (soft delete)", async () => {
    const r = await mutateRecord({ userId: owner, entity: "activity", op: "create", payload: { farmId: farmA, type: "FUNGICIDE", date: today, inventoryItemId: itemId, inventoryQuantity: "2" } });
    const id = (r.body as { record: { id: string } }).record.id;
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantity)).toBe(4);
    await mutateRecord({ userId: owner, entity: "activity", op: "delete", id });
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantity)).toBe(6);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
  });
});

describe("offline sync guarantees", () => {
  it("client-id create is idempotent", async () => {
    const id = randomUUID();
    const payload = { id, farmId: farmA, category: "TRANSPORT", amount: "500", date: today };
    const a = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload });
    const b = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload });
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect((b.body as { duplicate: boolean }).duplicate).toBe(true);
    expect(await prisma.expense.count({ where: { id } })).toBe(1);
  });

  it("a replayed mutation id returns the stored response without re-running", async () => {
    const mutationId = randomUUID();
    const payload = { farmId: farmA, category: "FUEL", amount: "300", date: today };
    const a = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload, mutationId });
    const b = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload, mutationId });
    expect((b.body as { replayed: boolean }).replayed).toBe(true);
    expect((b.body as { record: { id: string } }).record.id).toBe((a.body as { record: { id: string } }).record.id);
    expect(await prisma.expense.count({ where: { farmId: farmA, category: "FUEL" } })).toBe(1);
  });

  it("stale edits are rejected with the server copy (no silent overwrite)", async () => {
    const r = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload: { farmId: farmA, category: "OTHER", amount: "100", date: today } });
    const rec = (r.body as { record: { id: string; version: number } }).record;
    const ok = await mutateRecord({ userId: manager, entity: "expense", op: "update", id: rec.id, baseVersion: rec.version, payload: { category: "OTHER", amount: "150", date: today } });
    expect(ok.status).toBe(200);
    const stale = await mutateRecord({ userId: owner, entity: "expense", op: "update", id: rec.id, baseVersion: rec.version, payload: { category: "OTHER", amount: "999", date: today } });
    expect(stale.status).toBe(409);
    expect((stale.body as { conflict: string; server: { amount: number } }).conflict).toBe("version");
    expect((stale.body as { server: { amount: number } }).server.amount).toBe(150);
    expect(Number((await prisma.expense.findUniqueOrThrow({ where: { id: rec.id } })).amount)).toBe(150);
  });

  it("editing a record deleted elsewhere is reported as a conflict", async () => {
    const r = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload: { farmId: farmA, category: "OTHER", amount: "10", date: today } });
    const rec = (r.body as { record: { id: string; version: number } }).record;
    await mutateRecord({ userId: owner, entity: "expense", op: "delete", id: rec.id });
    const u = await mutateRecord({ userId: manager, entity: "expense", op: "update", id: rec.id, baseVersion: rec.version, payload: { category: "OTHER", amount: "20", date: today } });
    expect(u.status).toBe(409);
    expect((u.body as { conflict: string }).conflict).toBe("deleted");
  });
});

describe("authorization (server-side)", () => {
  it("a viewer cannot write, and cannot read money records", async () => {
    await expect(mutateRecord({ userId: viewer, entity: "activity", op: "create", payload: { farmId: farmA, type: "OTHER", date: today } })).rejects.toThrow(/cannot change/);
    await expect(checkReadAccess(viewer, "expense", farmA)).rejects.toThrow();
    await expect(checkReadAccess(viewer, "activity", farmA)).resolves.toBe("VIEWER");
  });
  it("a finance viewer can read money but not write it", async () => {
    await expect(checkReadAccess(finViewer, "expense", farmA)).resolves.toBe("FINANCE_VIEWER");
    await expect(mutateRecord({ userId: finViewer, entity: "expense", op: "create", payload: { farmId: farmA, category: "OTHER", amount: "1", date: today } })).rejects.toThrow();
  });
  it("a non-member gets 'not found' (existence is not leaked)", async () => {
    await expect(mutateRecord({ userId: stranger, entity: "activity", op: "create", payload: { farmId: farmA, type: "OTHER", date: today } })).rejects.toThrow(/Farm not found/);
    const r = await mutateRecord({ userId: owner, entity: "expense", op: "create", payload: { farmId: farmA, category: "OTHER", amount: "5", date: today } });
    const id = (r.body as { record: { id: string } }).record.id;
    await expect(mutateRecord({ userId: stranger, entity: "expense", op: "delete", id })).rejects.toThrow(/Farm not found/);
  });
  it("references to another farm's plot are rejected", async () => {
    await expect(mutateRecord({ userId: owner, entity: "activity", op: "create", payload: { farmId: farmA, plotId: plotB, type: "OTHER", date: today } })).rejects.toThrow(/does not belong/);
  });
  it("a manager can record labour", async () => {
    const r = await mutateRecord({ userId: manager, entity: "labor", op: "create", payload: { farmId: farmA, taskCategory: "spraying", date: today, wageType: "DAILY", units: "1", rate: "800", workerCount: "3" } });
    expect(r.status).toBe(201);
    expect(Number((r.body as { record: { totalCost: number } }).record.totalCost)).toBe(2400);
  });
});

describe("labour payments", () => {
  it("one record per named worker; payments update status; overpayment blocked", async () => {
    const w1 = (await prisma.worker.create({ data: { farmId: farmA, name: "Ramesh", category: "climbing" } })).id;
    const w2 = (await prisma.worker.create({ data: { farmId: farmA, name: "Suresh", category: "spraying" } })).id;
    const r = await mutateRecord({ userId: owner, entity: "labor", op: "create", payload: { farmId: farmA, workerIds: [w1, w2], taskCategory: "harvesting", date: today, wageType: "DAILY", units: "1", rate: "1000", additionalCost: "200" } });
    const { records } = (r.body as { record: { records: { id: string; totalCost: number }[] } }).record;
    expect(records).toHaveLength(2);
    expect(records.map((x) => Number(x.totalCost)).sort()).toEqual([1000, 1200]); // extra cost attached once
    const rec = records.find((x) => Number(x.totalCost) === 1000)!;
    await mutateRecord({ userId: owner, entity: "laborPayment", op: "create", payload: { laborRecordId: rec.id, amount: "400", date: today } });
    expect((await prisma.laborRecord.findUniqueOrThrow({ where: { id: rec.id } })).paymentStatus).toBe("PARTIAL");
    await expect(mutateRecord({ userId: owner, entity: "laborPayment", op: "create", payload: { laborRecordId: rec.id, amount: "700", date: today } })).rejects.toThrow(/pending/);
    await mutateRecord({ userId: owner, entity: "laborPayment", op: "create", payload: { laborRecordId: rec.id, amount: "600", date: today } });
    const done = await prisma.laborRecord.findUniqueOrThrow({ where: { id: rec.id } });
    expect(done.paymentStatus).toBe("PAID");
    expect(Number(done.amountPaid)).toBe(1000);
  });
});

describe("harvest-linked sales", () => {
  it("cannot sell more than was harvested, and computes net", async () => {
    const h = await mutateRecord({ userId: owner, entity: "harvest", op: "create", payload: { farmId: farmA, plotId: plotA, cropId, date: today, quantity: "500", unit: "kg" } });
    const harvestId = (h.body as { record: { id: string } }).record.id;
    const s = await mutateRecord({ userId: owner, entity: "income", op: "create", payload: { farmId: farmA, harvestId, date: today, quantity: "400", unit: "kg", pricePerUnit: "470", transportCost: "500" } });
    expect(Number((s.body as { record: { netAmount: number } }).record.netAmount)).toBe(187500);
    await expect(mutateRecord({ userId: owner, entity: "income", op: "create", payload: { farmId: farmA, harvestId, date: today, quantity: "200", unit: "kg", pricePerUnit: "470" } })).rejects.toThrow(/unsold/);
    await expect(mutateRecord({ userId: owner, entity: "income", op: "create", payload: { farmId: farmA, harvestId, date: today, quantity: "50", unit: "quintal", pricePerUnit: "1" } })).rejects.toThrow(/unit/);
  });
});

describe("finance aggregation from records", () => {
  it("expenditure = expenses + completed labour; net = income − expenditure", async () => {
    const f = await loadFinance({ farmIds: [farmA], from: new Date("2026-11-01"), to: new Date("2026-11-30") });
    const expenses = await prisma.expense.aggregate({ where: { farmId: farmA, deletedAt: null }, _sum: { amount: true } });
    const labor = await prisma.laborRecord.aggregate({ where: { farmId: farmA, deletedAt: null, workStatus: "COMPLETED" }, _sum: { totalCost: true } });
    const income = await prisma.income.aggregate({ where: { farmId: farmA, deletedAt: null }, _sum: { netAmount: true } });
    expect(f.summary.totalExpense).toBeCloseTo(Number(expenses._sum.amount) + Number(labor._sum.totalCost), 2);
    expect(f.summary.totalIncome).toBeCloseTo(Number(income._sum.netAmount), 2);
    expect(f.summary.net).toBeCloseTo(f.summary.totalIncome - f.summary.totalExpense, 2);
    expect(f.byCategory.LABOR).toBeCloseTo(Number(labor._sum.totalCost), 2);
  });
});

describe("auth primitives", () => {
  it("bcrypt hashes verify; session tokens are random and stored hashed", async () => {
    const h = await hashPassword("correct horse");
    expect(h).not.toContain("correct");
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    const t1 = newSessionToken(), t2 = newSessionToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(t1)).toMatch(/^[a-f0-9]{64}$/);
  });
});
