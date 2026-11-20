/* KRSHI seed: reference data (crops, schemes, resources, SAMPLE market prices) + a demo account.
   Re-runnable: reference data is upserted; the demo account is deleted and recreated. */
import { PrismaClient, type ActivityType, type ExpenseCategory, type WageType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CROPS, RESOURCES, SAMPLE_COMMODITIES, SAMPLE_MARKETS, SCHEMES } from "./seed-data";
import { laborTotal, paymentStatus } from "../src/lib/calc/labor";

const prisma = new PrismaClient();
const SAMPLE_SOURCE = "KRSHI sample dataset (illustrative — not real prices)";

const DAY = 86400000;
/** Calendar date N days from today (IST), as UTC midnight to match DATE columns. */
function d(offset: number) {
  const ist = new Date(Date.now() + 5.5 * 3600000 + offset * DAY);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

// deterministic PRNG so sample prices are stable between runs
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function reference() {
  for (const c of CROPS) await prisma.crop.upsert({ where: { key: c.key }, update: { name: c.name, nameKn: c.nameKn, category: c.category, isSystem: true }, create: { ...c, isSystem: true } });
  for (const s of SCHEMES) await prisma.scheme.upsert({ where: { slug: s.slug }, update: s, create: s });
  await prisma.resource.deleteMany({});
  await prisma.resource.createMany({ data: RESOURCES });

  // SAMPLE market data: 120 days of illustrative prices. Clearly labelled; never presented as live.
  await prisma.marketPrice.deleteMany({ where: { dataKind: "SAMPLE" } });
  const rows = [];
  const r = rng(42);
  for (const c of SAMPLE_COMMODITIES) {
    for (const mName of c.markets) {
      const m = SAMPLE_MARKETS.find((x) => x.market === mName)!;
      let level = c.base * (0.96 + r() * 0.08);
      for (let i = 120; i >= 0; i--) {
        level = level * (1 + (r() - 0.5) * 2 * c.vol);
        if (i % 7 === 0 || r() < 0.25) continue; // markets do not report every day
        const modal = Math.round(level / 10) * 10;
        const spread = modal * (0.04 + r() * 0.05);
        rows.push({
          commodity: c.commodity, cropKey: c.cropKey, variety: c.variety, grade: "FAQ", market: m.market, district: m.district, state: "Karnataka",
          priceDate: d(-i), minPrice: Math.round((modal - spread) / 10) * 10, maxPrice: Math.round((modal + spread * 0.7) / 10) * 10, modalPrice: modal,
          unit: "Rs/Quintal", source: SAMPLE_SOURCE, sourceUrl: "/docs/integrations#market-prices", dataKind: "SAMPLE" as const, retrievedAt: new Date(),
        });
      }
    }
  }
  await prisma.marketPrice.createMany({ data: rows, skipDuplicates: true });
  console.log(`reference data: ${CROPS.length} crops, ${SCHEMES.length} schemes, ${RESOURCES.length} resources, ${rows.length} sample prices`);
}

async function demo() {
  const email = "demo@krishi.app";
  await prisma.farm.deleteMany({ where: { isDemo: true } });
  await prisma.user.deleteMany({ where: { email: { in: [email, "manager@krishi.app"] } } });
  const crop = Object.fromEntries((await prisma.crop.findMany()).map((c) => [c.key, c.id]));
  const pw = await bcrypt.hash("krishi-demo-2026", 12);

  const user = await prisma.user.create({
    data: { email, passwordHash: pw, name: "Shankara Bhat (demo)", phone: "+91 90000 00000", language: "en", district: "Dakshina Kannada", taluk: "Bantwal", village: "Kedila", isDemo: true, settings: { create: {} } },
  });
  const manager = await prisma.user.create({
    data: { email: "manager@krishi.app", passwordHash: pw, name: "Prakash (demo manager)", language: "kn", district: "Dakshina Kannada", isDemo: true, settings: { create: { voiceLanguage: "kn-IN" } } },
  });

  const f1 = await prisma.farm.create({
    data: {
      name: "Kedila Arecanut Garden (demo)", district: "Dakshina Kannada", taluk: "Bantwal", village: "Kedila", location: "Near Kedila, Bantwal taluk",
      latitude: 12.8312, longitude: 75.1415, totalArea: 5, areaUnit: "ACRE", isDemo: true,
      description: "Demo farm — arecanut with pepper and cocoa as intercrops.",
      memberships: { create: [{ userId: user.id, role: "OWNER" }, { userId: manager.id, role: "MANAGER", invitedById: user.id }] },
    },
  });
  const f2 = await prisma.farm.create({
    data: {
      name: "Brahmavar Paddy & Coconut (demo)", district: "Udupi", taluk: "Brahmavar", village: "Handady", location: "Brahmavar",
      latitude: 13.4363, longitude: 74.7487, totalArea: 2.5, areaUnit: "ACRE", isDemo: true, description: "Demo farm — coconut grove, paddy field and vegetables.",
      memberships: { create: [{ userId: user.id, role: "OWNER" }] },
    },
  });
  await prisma.userSettings.update({ where: { userId: user.id }, data: { currentFarmId: f1.id } });
  await prisma.userSettings.update({ where: { userId: manager.id }, data: { currentFarmId: f1.id } });

  const mk = (farmId: string, name: string, area: number, cropKey: string, extra: object = {}) => prisma.plot.create({ data: { farmId, name, area, areaUnit: "ACRE", cropId: crop[cropKey], ...extra } });
  const pA = await mk(f1.id, "Areca Block A", 2, "arecanut", { variety: "Mangala", plantingDate: new Date("2008-07-15"), plantCount: 900, soilType: "Laterite", irrigation: "Sprinkler from open well" });
  const pB = await mk(f1.id, "Areca Block B", 1.5, "arecanut", { variety: "Sumangala", plantingDate: new Date("2016-06-20"), plantCount: 680, soilType: "Laterite", irrigation: "Drip" });
  const pP = await mk(f1.id, "Pepper on areca (Block A)", 1, "pepper", { variety: "Panniyur-1", plantingDate: new Date("2014-06-10"), plantCount: 400, notes: "Trailed on areca palms" });
  const pC = await mk(f1.id, "Cocoa intercrop", 0.5, "cocoa", { plantingDate: new Date("2019-07-01"), plantCount: 150 });
  const pCo = await mk(f2.id, "Coconut grove", 1.2, "coconut", { variety: "West Coast Tall", plantingDate: new Date("2001-06-01"), plantCount: 80, soilType: "Sandy loam", irrigation: "Basin irrigation" });
  const pPa = await mk(f2.id, "Paddy field", 1, "paddy", { variety: "MO-4", plantingDate: d(-150), soilType: "Clay loam", irrigation: "Rainfed" });
  const pV = await mk(f2.id, "Vegetable patch", 0.3, "vegetables", { variety: "Udupi Gulla brinjal, cucumber", plantingDate: d(-40), irrigation: "Hose / pot" });

  // workers
  const w = async (farmId: string, name: string, category: string, wage: number, wageType: WageType = "DAILY") => prisma.worker.create({ data: { farmId, name, category, defaultWage: wage, wageType } });
  const ramesh = await w(f1.id, "Ramesh", "climbing", 1200);
  const suresh = await w(f1.id, "Suresh", "spraying", 900);
  const lakshmi = await w(f1.id, "Lakshmi", "cleaning", 700);
  const ganesh = await w(f1.id, "Ganesh", "harvesting", 1000);
  const vimala = await w(f2.id, "Vimala", "planting", 700);
  const babu = await w(f2.id, "Babu", "climbing", 50, "TASK");

  // inventory
  const inv = async (farmId: string, name: string, category: "FERTILIZER" | "PESTICIDE" | "SEEDS" | "TOOLS" | "IRRIGATION" | "OTHER", unit: string, purchased: number, used: number, unitCost: number, extra: object = {}) => {
    const item = await prisma.inventoryItem.create({ data: { farmId, name, category, unit, quantity: purchased - used, ...extra } });
    await prisma.inventoryTransaction.create({ data: { itemId: item.id, type: "PURCHASE", quantity: purchased, delta: purchased, unitCost, totalCost: purchased * unitCost, date: d(-120), createdById: user.id, notes: "Demo opening stock" } });
    if (used) await prisma.inventoryTransaction.create({ data: { itemId: item.id, type: "USAGE", quantity: used, delta: -used, date: d(-60), createdById: user.id, notes: "Demo usage" } });
    return item;
  };
  const cuso4 = await inv(f1.id, "Copper sulphate", "PESTICIDE", "kg", 30, 22, 240, { lowStockThreshold: 10, supplier: "Bantwal Agro Centre" });
  await inv(f1.id, "Lime (chunam)", "OTHER", "kg", 30, 20, 30, { lowStockThreshold: 5 });
  await inv(f1.id, "Organic manure (bags)", "FERTILIZER", "bag", 60, 40, 180, { lowStockThreshold: 10 });
  await inv(f1.id, "Rajphos (rock phosphate)", "FERTILIZER", "kg", 100, 50, 14, { lowStockThreshold: 25 });
  await inv(f1.id, "Neem cake", "FERTILIZER", "kg", 50, 0, 32, { expiryDate: d(25), storageNotes: "Store dry, off the floor" });
  await inv(f2.id, "Paddy seed MO-4", "SEEDS", "kg", 30, 30, 45);
  await inv(f2.id, "Brinjal seedlings", "SEEDS", "nos", 300, 250, 2);

  // activities (demo records — quantities are the farmer's own records, NOT recommendations)
  const NOTE = "Demo record — illustrative only, not a recommendation.";
  const act = (farmId: string, plotId: string, cropKey: string, type: ActivityType, offset: number, extra: object = {}) =>
    prisma.activity.create({ data: { farmId, plotId, cropId: crop[cropKey], type, date: d(offset), createdById: user.id, ...extra } });
  const sprayA = await act(f1.id, pA.id, "arecanut", "FUNGICIDE", -150, { description: "Pre-monsoon prophylactic spray of Bordeaux mixture against koleroga (fruit rot)", productName: "Bordeaux mixture (home prepared)", productCategory: "Copper fungicide", quantity: 12, quantityUnit: "kg", dilution: "As advised by RSK officer", waterQuantity: 1200, waterUnit: "l", areaCovered: 2, areaUnit: "ACRE", cost: 3600, laborDetails: "Suresh + Ramesh (climbing)", sourceReference: NOTE });
  await act(f1.id, pB.id, "arecanut", "FUNGICIDE", -148, { description: "Bordeaux spray, Block B", productName: "Bordeaux mixture (home prepared)", productCategory: "Copper fungicide", quantity: 10, quantityUnit: "kg", waterQuantity: 900, waterUnit: "l", cost: 2900, laborDetails: "Suresh, Ramesh", sourceReference: NOTE });
  await act(f1.id, pA.id, "arecanut", "FUNGICIDE", -105, { description: "Second Bordeaux spray after 45 days", productName: "Bordeaux mixture (home prepared)", quantity: 12, quantityUnit: "kg", waterQuantity: 1200, waterUnit: "l", cost: 3800, laborDetails: "Suresh, Ramesh", sourceReference: NOTE });
  await act(f1.id, pA.id, "arecanut", "FERTILIZER", -170, { description: "Organic manure applied to basins", productName: "Organic manure", productCategory: "Organic", quantity: 20, quantityUnit: "bag", cost: 3600, laborDetails: "Lakshmi + 2", sourceReference: NOTE });
  await act(f1.id, pB.id, "arecanut", "FERTILIZER", -95, { description: "Rock phosphate and manure", productName: "Rajphos", productCategory: "Phosphatic fertilizer", quantity: 50, quantityUnit: "kg", cost: 700, followUpDate: d(12) });
  await act(f1.id, pA.id, "arecanut", "CLEANING", -40, { description: "Weeding and basin cleaning after monsoon", cost: 2100, laborDetails: "Lakshmi + 2 workers" });
  await act(f1.id, pP.id, "pepper", "PRUNING", -30, { description: "Removed runner shoots and tied vines", laborDetails: "Ganesh" });
  await act(f1.id, pA.id, "arecanut", "IRRIGATION", -12, { description: "Started sprinkler irrigation for the dry season — every 5 days", waterQuantity: 20000, waterUnit: "l" });
  await act(f1.id, pB.id, "arecanut", "HARVESTING", -8, { description: "First round harvest of ripe nuts", laborDetails: "Ramesh (climber), Ganesh" });
  await act(f1.id, pC.id, "cocoa", "HARVESTING", -20, { description: "Cocoa pod harvest", quantity: 180, quantityUnit: "nos" });
  await act(f2.id, pPa.id, "paddy", "PLANTING", -150, { description: "Transplanting MO-4 seedlings", laborDetails: "Vimala + 5", cost: 4200 });
  await act(f2.id, pPa.id, "paddy", "HARVESTING", -25, { description: "Paddy harvest with combine harvester (rented)", cost: 3500 });
  await act(f2.id, pCo.id, "coconut", "HARVESTING", -18, { description: "Coconut plucking — 80 palms", laborDetails: "Babu (per palm)" });
  await act(f2.id, pV.id, "vegetables", "PLANTING", -40, { description: "Planted brinjal and cucumber" });
  await prisma.inventoryTransaction.create({ data: { itemId: cuso4.id, type: "USAGE", quantity: 0, delta: 0, date: d(-150), activityId: sprayA.id, createdById: user.id, notes: "Linked to activity (demo)" } });

  // labour
  const lab = async (farmId: string, plotId: string | null, workerId: string | null, category: string, offset: number, wageType: WageType, units: number, rate: number, paidFraction: number, extra: { workerCount?: number; workerLabel?: string; additionalCost?: number } = {}) => {
    const total = laborTotal({ workerCount: extra.workerCount ?? 1, units, rate, additionalCost: extra.additionalCost ?? 0 });
    const paid = Math.round(total * paidFraction);
    const rec = await prisma.laborRecord.create({
      data: { farmId, plotId, workerId, taskCategory: category, date: d(offset), wageType, units, rate, totalCost: total, amountPaid: paid, paymentStatus: paymentStatus(total, paid), createdById: user.id, workerCount: extra.workerCount ?? 1, workerLabel: extra.workerLabel, additionalCost: extra.additionalCost ?? 0 },
    });
    if (paid > 0) await prisma.laborPayment.create({ data: { laborRecordId: rec.id, amount: paid, date: d(offset + 1), method: "cash" } });
  };
  for (const [off, plot] of [[-150, pA.id], [-148, pB.id], [-105, pA.id]] as const) {
    await lab(f1.id, plot, suresh.id, "spraying", off, "DAILY", 1, 900, 1);
    await lab(f1.id, plot, ramesh.id, "climbing", off, "DAILY", 1, 1200, 1);
  }
  await lab(f1.id, pA.id, lakshmi.id, "cleaning", -170, "DAILY", 2, 700, 1);
  await lab(f1.id, pA.id, null, "cleaning", -40, "DAILY", 1, 700, 1, { workerCount: 3, workerLabel: "Lakshmi's group" });
  await lab(f1.id, pP.id, ganesh.id, "pruning", -30, "DAILY", 1, 1000, 1);
  await lab(f1.id, pB.id, ramesh.id, "harvesting", -8, "DAILY", 1, 1200, 0);
  await lab(f1.id, pB.id, ganesh.id, "harvesting", -8, "DAILY", 1, 1000, 0.5);
  await lab(f1.id, pA.id, lakshmi.id, "cleaning", -3, "HALF_DAY", 2, 400, 0);
  await lab(f2.id, pPa.id, null, "planting", -150, "DAILY", 1, 700, 1, { workerCount: 6, workerLabel: "Transplanting group", additionalCost: 300 });
  await lab(f2.id, pCo.id, babu.id, "climbing", -18, "TASK", 80, 50, 1);
  await lab(f2.id, pV.id, vimala.id, "planting", -40, "DAILY", 1, 700, 1);

  // expenses
  const exp = (farmId: string, category: ExpenseCategory, amount: number, offset: number, description: string, plotId?: string, cropKey?: string) =>
    prisma.expense.create({ data: { farmId, category, amount, date: d(offset), description, plotId, cropId: cropKey ? crop[cropKey] : undefined, paymentMethod: "cash", createdById: user.id } });
  await exp(f1.id, "PESTICIDE", 7200, -160, "Copper sulphate 30 kg", undefined, "arecanut");
  await exp(f1.id, "FERTILIZER", 10800, -175, "Organic manure 60 bags", undefined, "arecanut");
  await exp(f1.id, "FERTILIZER", 1400, -100, "Rajphos 100 kg", pB.id, "arecanut");
  await exp(f1.id, "ELECTRICITY", 1850, -130, "Pump set electricity bill");
  await exp(f1.id, "ELECTRICITY", 2100, -10, "Pump set electricity bill");
  await exp(f1.id, "MAINTENANCE", 1600, -60, "Sprayer repair and new nozzle");
  await exp(f1.id, "TRANSPORT", 1200, -6, "Arecanut transport to Puttur", undefined, "arecanut");
  await exp(f1.id, "IRRIGATION", 4500, -20, "Sprinkler pipes and fittings", pA.id, "arecanut");
  await exp(f1.id, "FUEL", 900, -45, "Petrol for brush cutter");
  await exp(f2.id, "SEEDS", 1350, -155, "Paddy seed MO-4 30 kg", pPa.id, "paddy");
  await exp(f2.id, "RENTAL", 3500, -25, "Combine harvester rent", pPa.id, "paddy");
  await exp(f2.id, "SEEDS", 600, -41, "Brinjal & cucumber seedlings", pV.id, "vegetables");
  await exp(f2.id, "FERTILIZER", 2400, -70, "Coconut fertilizer", pCo.id, "coconut");

  // harvests & sales
  const harv = (farmId: string, plotId: string, cropKey: string, offset: number, quantity: number, unit: string, grade?: string) =>
    prisma.harvest.create({ data: { farmId, plotId, cropId: crop[cropKey], date: d(offset), quantity, unit, grade, createdById: user.id } });
  const sale = (farmId: string, plotId: string | null, cropKey: string, offset: number, quantity: number, unit: string, price: number, extra: { harvestId?: string; buyer?: string; market?: string; transportCost?: number; otherDeductions?: number; received?: number } = {}) => {
    const gross = Math.round(quantity * price * 100) / 100;
    const net = gross - (extra.transportCost ?? 0) - (extra.otherDeductions ?? 0);
    const received = extra.received ?? net;
    return prisma.income.create({
      data: { farmId, plotId, cropId: crop[cropKey], harvestId: extra.harvestId, quantity, unit, pricePerUnit: price, grossAmount: gross, transportCost: extra.transportCost ?? 0, otherDeductions: extra.otherDeductions ?? 0, netAmount: net, amountReceived: received, paymentStatus: paymentStatus(net, received), buyer: extra.buyer, market: extra.market, date: d(offset), createdById: user.id },
    });
  };
  const hA = await harv(f1.id, pA.id, "arecanut", -300, 1450, "kg", "Chali");
  await sale(f1.id, pA.id, "arecanut", -280, 900, "kg", 455, { harvestId: hA.id, buyer: "Cooperative society (demo)", market: "Puttur", transportCost: 800 });
  await sale(f1.id, pA.id, "arecanut", -200, 400, "kg", 470, { harvestId: hA.id, buyer: "Local trader (demo)", market: "Bantwal", transportCost: 500 });
  const hB = await harv(f1.id, pB.id, "arecanut", -8, 380, "kg", "Ripe nuts (to dry)");
  void hB;
  const hP = await harv(f1.id, pP.id, "pepper", -240, 160, "kg", "Dried");
  await sale(f1.id, pP.id, "pepper", -220, 160, "kg", 640, { harvestId: hP.id, buyer: "Spice trader (demo)", market: "Puttur", transportCost: 300 });
  const hC = await harv(f1.id, pC.id, "cocoa", -20, 120, "kg", "Wet beans");
  await sale(f1.id, pC.id, "cocoa", -19, 120, "kg", 72, { harvestId: hC.id, buyer: "Cooperative society (demo)", received: 4000 });
  const hPa = await harv(f2.id, pPa.id, "paddy", -25, 14, "quintal", "MO-4");
  await sale(f2.id, pPa.id, "paddy", -15, 10, "quintal", 2350, { harvestId: hPa.id, buyer: "Rice mill (demo)", market: "Brahmavar", transportCost: 600 });
  const hCo = await harv(f2.id, pCo.id, "coconut", -18, 4200, "nuts", "Medium");
  await sale(f2.id, pCo.id, "coconut", -16, 4000, "nuts", 17, { harvestId: hCo.id, buyer: "Local trader (demo)", market: "Udupi" });
  await sale(f2.id, pV.id, "vegetables", -4, 85, "kg", 38, { buyer: "Weekly santhe (demo)", market: "Brahmavar" });

  // tasks
  const task = (farmId: string, plotId: string | null, title: string, category: string, offset: number, status: "PLANNED" | "COMPLETED" | "IN_PROGRESS" = "PLANNED", extra: object = {}) =>
    prisma.task.create({ data: { farmId, plotId, title, category, date: d(offset), status, createdById: user.id, reminderDays: 1, ...extra } });
  const t1 = await task(f1.id, pB.id, "Second round arecanut harvest — Block B", "harvesting", 3, "PLANNED", { estimatedCost: 2200, time: "07:30" });
  await prisma.taskWorker.createMany({ data: [{ taskId: t1.id, workerId: ramesh.id }, { taskId: t1.id, workerId: ganesh.id }] });
  await task(f1.id, pA.id, "Apply organic manure to Block A basins", "fertilizer", 6, "PLANNED", { estimatedCost: 4000 });
  await task(f1.id, null, "Service the pump set before summer", "maintenance", 10, "PLANNED", { estimatedCost: 1500 });
  await task(f1.id, pB.id, "Check drip lines for blockages", "irrigation", 1, "IN_PROGRESS");
  await task(f1.id, pA.id, "Weeding after monsoon", "cleaning", -40, "COMPLETED", { actualCost: 2100 });
  await task(f2.id, pV.id, "Harvest brinjal", "harvesting", 2, "PLANNED");
  await task(f2.id, pCo.id, "Coconut plucking (45-day cycle)", "harvesting", 27, "PLANNED", { estimatedCost: 4000 });

  // soil tests (as if copied from a lab report)
  await prisma.soilTest.create({ data: { farmId: f1.id, plotId: pA.id, testDate: new Date("2024-03-12"), laboratory: "District soil testing laboratory (demo)", soilType: "Laterite", ph: 5.1, ec: 0.08, organicCarbon: 0.92, nitrogen: 240, phosphorus: 18, potassium: 160, micronutrients: { Zn: 0.7, B: 0.35 }, createdById: user.id, notes: "Demo values" } });
  await prisma.soilTest.create({ data: { farmId: f1.id, plotId: pA.id, testDate: d(-200), laboratory: "District soil testing laboratory (demo)", soilType: "Laterite", ph: 5.6, ec: 0.1, organicCarbon: 1.05, nitrogen: 265, phosphorus: 24, potassium: 175, micronutrients: { Zn: 0.9, B: 0.42 }, createdById: user.id, notes: "Demo values — after liming" } });
  await prisma.soilTest.create({ data: { farmId: f2.id, plotId: pPa.id, testDate: d(-400), laboratory: "Soil Health Card (demo)", soilType: "Clay loam", ph: 5.9, organicCarbon: 0.7, nitrogen: 280, phosphorus: 22, potassium: 140, createdById: user.id, notes: "Demo values" } });

  // equipment
  const sprayer = await prisma.equipment.create({ data: { farmId: f1.id, name: "HTP power sprayer", category: "sprayer", purchaseDate: new Date("2021-04-10"), purchaseCost: 28000 } });
  await prisma.equipment.create({ data: { farmId: f1.id, name: "5 HP pump set", category: "pump", purchaseDate: new Date("2015-02-01"), purchaseCost: 22000 } });
  await prisma.equipment.create({ data: { farmId: f1.id, name: "Areca tree climber", category: "climber", purchaseDate: new Date("2022-09-01"), purchaseCost: 6500 } });
  const log = await prisma.equipmentLog.create({ data: { equipmentId: sprayer.id, type: "REPAIR", date: d(-60), cost: 1600, description: "Pump seal and nozzle replaced", nextDueDate: d(30) } });
  await prisma.expense.updateMany({ where: { farmId: f1.id, description: "Sprayer repair and new nozzle" }, data: { equipmentLogId: log.id } });

  // crop issue
  await prisma.cropIssue.create({ data: { farmId: f1.id, plotId: pB.id, cropId: crop.arecanut, title: "Immature nut fall in Block B", description: "Small nuts falling from about 30 palms on the eastern side. Some nuts have dark patches.", symptoms: ["nut fall", "dark patches on nuts"], affectedArea: "About 30 palms", startedOn: d(-14), previousTreatments: "Bordeaux spray done twice before/during monsoon", status: "OPEN", createdById: user.id } });

  // scheme tracking
  const pmk = await prisma.scheme.findUnique({ where: { slug: "pm-kisan" } });
  const mi = await prisma.scheme.findUnique({ where: { slug: "pmksy-per-drop-more-crop" } });
  if (pmk) await prisma.schemeTracker.create({ data: { userId: user.id, schemeId: pmk.id, status: "APPROVED", collectedDocuments: pmk.documents, notes: "Instalments received (demo)" } });
  if (mi) await prisma.schemeTracker.create({ data: { userId: user.id, schemeId: mi.id, status: "COLLECTING_DOCUMENTS", collectedDocuments: mi.documents.slice(0, 2), followUpDate: d(7), notes: "Ask RSK about drip subsidy for Block A (demo)" } });

  await prisma.marketFavorite.createMany({ data: [{ userId: user.id, kind: "CROP", value: "arecanut" }, { userId: user.id, kind: "CROP", value: "pepper" }, { userId: user.id, kind: "MARKET", value: "Puttur" }] });
  await prisma.inputProduct.create({ data: { userId: user.id, name: "Example: product from label", category: "fungicide", notes: "Save the dose printed on your product label here, with its source. (Demo entry without a dose.)" } });

  console.log(`demo account: ${email} / krishi-demo-2026 (also manager@krishi.app, same password)`);
}

reference()
  .then(() => (process.env.SEED_DEMO === "false" ? undefined : demo()))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
