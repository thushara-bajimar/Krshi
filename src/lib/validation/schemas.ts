import { z } from "zod";

// ---- primitives that tolerate HTML form values ("" -> undefined, "12" -> 12)
const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

export const optStr = (max = 500) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
export const reqStr = (max = 200, msg = "Required") => z.string({ required_error: msg }).trim().min(1, msg).max(max);
export const optNum = (min = 0) =>
  z.preprocess(emptyToUndef, z.coerce.number({ invalid_type_error: "Enter a number" }).min(min, `Must be at least ${min}`).optional());
export const reqNum = (min = 0, msg = "Enter a number") =>
  z.preprocess(emptyToUndef, z.coerce.number({ required_error: msg, invalid_type_error: msg }).min(min, `Must be at least ${min}`));
export const posNum = (msg = "Must be greater than zero") =>
  z.preprocess(emptyToUndef, z.coerce.number({ required_error: "Required", invalid_type_error: "Enter a number" }).positive(msg));
export const dateStr = z
  .string({ required_error: "Choose a date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const optDate = z.preprocess(emptyToUndef, dateStr.optional());
export const optId = z.preprocess(emptyToUndef, z.string().uuid().optional());
export const clientId = z.string().uuid().optional(); // client-generated id for offline-created records

export const AREA_UNIT = z.enum(["ACRE", "CENT", "GUNTA", "HECTARE", "SQ_M"]);
export const ACTIVITY_TYPES = [
  "FERTILIZER", "PESTICIDE", "FUNGICIDE", "HERBICIDE", "IRRIGATION", "PRUNING", "CLEANING", "PLANTING",
  "HARVESTING", "SOIL_PREPARATION", "PEST_MANAGEMENT", "DISEASE_MANAGEMENT", "EQUIPMENT_USAGE", "OTHER",
] as const;
export const EXPENSE_CATEGORIES = [
  "FERTILIZER", "PESTICIDE", "SEEDS", "LABOR", "MACHINERY", "EQUIPMENT", "IRRIGATION", "ELECTRICITY", "FUEL",
  "TRANSPORT", "MAINTENANCE", "RENTAL", "OTHER",
] as const;
export const INVENTORY_CATEGORIES = ["FERTILIZER", "PESTICIDE", "SEEDS", "TOOLS", "EQUIPMENT", "IRRIGATION", "OTHER"] as const;
export const WORK_CATEGORIES = ["spraying", "harvesting", "climbing", "pruning", "cleaning", "planting", "irrigation", "transport", "weeding", "fertilizer", "other"] as const;
export const TASK_CATEGORIES = ["fertilizer", "spraying", "irrigation", "cleaning", "pruning", "harvesting", "planting", "maintenance", "labor", "other"] as const;
export const WAGE_TYPES = ["DAILY", "HALF_DAY", "HOURLY", "TASK"] as const;
export const QTY_UNITS = ["kg", "g", "quintal", "tonne", "l", "ml", "bag", "packet", "nos", "bunch", "nuts"] as const;

// ---- auth & profile
export const registerSchema = z.object({
  name: reqStr(100, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  phone: z.preprocess(emptyToUndef, z.string().regex(/^[+0-9 ]{10,15}$/, "Enter a valid phone number").optional()),
  district: optStr(80),
  language: z.enum(["en", "kn"]).default("en"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const profileSchema = z.object({
  name: reqStr(100),
  phone: z.preprocess(emptyToUndef, z.string().regex(/^[+0-9 ]{10,15}$/, "Enter a valid phone number").optional()),
  language: z.enum(["en", "kn"]),
  district: optStr(80),
  taluk: optStr(80),
  village: optStr(80),
  areaUnit: AREA_UNIT,
});

export const settingsSchema = z.object({
  notifyTasks: z.boolean(),
  notifyInventory: z.boolean(),
  notifyPayments: z.boolean(),
  notifyWeather: z.boolean(),
  notifyPriceAlerts: z.boolean(),
  taskReminderDays: z.coerce.number().int().min(0).max(14),
  voiceLanguage: z.enum(["en-IN", "kn-IN"]),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Use at least 8 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

// ---- farms & plots
const lat = z.preprocess(emptyToUndef, z.coerce.number().min(-90).max(90).optional());
const lng = z.preprocess(emptyToUndef, z.coerce.number().min(-180).max(180).optional());

export const farmSchema = z.object({
  name: reqStr(100, "Enter a farm name"),
  district: reqStr(80, "Choose a district"),
  taluk: optStr(80),
  village: optStr(80),
  location: optStr(200),
  latitude: lat,
  longitude: lng,
  totalArea: optNum(0),
  areaUnit: AREA_UNIT.default("ACRE"),
  description: optStr(1000),
});

export const plotSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  name: reqStr(100, "Enter a plot name"),
  area: posNum("Enter the plot area"),
  areaUnit: AREA_UNIT.default("ACRE"),
  cropId: optId,
  variety: optStr(100),
  plantingDate: optDate,
  plantCount: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).optional()),
  soilType: optStr(100),
  irrigation: optStr(200),
  notes: optStr(1000),
  latitude: lat,
  longitude: lng,
  status: z.enum(["ACTIVE", "FALLOW", "PREPARING", "ARCHIVED"]).default("ACTIVE"),
});

export const cropSchema = z.object({
  name: reqStr(60, "Enter the crop name"),
  nameKn: optStr(60),
  category: z.enum(["plantation", "spice", "cereal", "fruit", "vegetable", "other"]).default("other"),
});

// ---- activity diary
export const activitySchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  plotId: optId,
  cropId: optId,
  type: z.enum(ACTIVITY_TYPES),
  date: dateStr,
  description: optStr(1000),
  productName: optStr(150),
  productCategory: optStr(60),
  quantity: optNum(0),
  quantityUnit: optStr(20),
  areaCovered: optNum(0),
  areaUnit: z.preprocess(emptyToUndef, AREA_UNIT.optional()),
  dilution: optStr(100),
  waterQuantity: optNum(0),
  waterUnit: optStr(20),
  cost: optNum(0),
  laborDetails: optStr(300),
  notes: optStr(2000),
  sourceReference: optStr(500),
  followUpDate: optDate,
  // optional side effects (executed in the same DB transaction)
  recordExpense: z.boolean().optional(),
  inventoryItemId: optId,
  inventoryQuantity: optNum(0),
});

// ---- labour
export const workerSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  name: reqStr(100, "Enter the worker's name"),
  phone: z.preprocess(emptyToUndef, z.string().regex(/^[+0-9 ]{10,15}$/, "Enter a valid phone number").optional()),
  category: z.enum(WORK_CATEGORIES).default("other"),
  defaultWage: optNum(0),
  wageType: z.enum(WAGE_TYPES).default("DAILY"),
  notes: optStr(500),
  active: z.boolean().default(true),
});

export const laborSchema = z
  .object({
    id: clientId,
    farmId: z.string().uuid(),
    plotId: optId,
    workerIds: z.array(z.string().uuid()).default([]), // one record per selected worker
    workerLabel: optStr(100),
    workerCount: z.coerce.number().int().min(1, "At least 1 worker").max(500).default(1),
    taskCategory: z.enum(WORK_CATEGORIES),
    description: optStr(500),
    date: dateStr,
    wageType: z.enum(WAGE_TYPES),
    units: posNum("Enter days/hours worked"),
    rate: reqNum(0, "Enter the wage rate"),
    additionalCost: optNum(0),
    totalOverride: optNum(0), // farmer may adjust the computed total
    amountPaid: optNum(0),
    paymentDate: optDate,
    workStatus: z.enum(["PLANNED", "COMPLETED"]).default("COMPLETED"),
    notes: optStr(1000),
    activityId: optId,
    taskId: optId,
  });

export const laborUpdateSchema = z.object({
  plotId: optId,
  taskCategory: z.enum(WORK_CATEGORIES),
  description: optStr(500),
  date: dateStr,
  wageType: z.enum(WAGE_TYPES),
  workerCount: z.coerce.number().int().min(1).max(500),
  units: posNum(),
  rate: reqNum(0),
  additionalCost: optNum(0),
  totalOverride: optNum(0),
  workStatus: z.enum(["PLANNED", "COMPLETED"]),
  notes: optStr(1000),
});

export const laborPaymentSchema = z.object({
  id: clientId,
  laborRecordId: z.string().uuid(),
  amount: posNum("Enter the amount paid"),
  date: dateStr,
  method: optStr(40),
  notes: optStr(300),
});

// ---- finance
export const expenseSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  plotId: optId,
  cropId: optId,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: posNum("Enter the amount"),
  date: dateStr,
  description: optStr(500),
  paymentMethod: optStr(40),
  vendor: optStr(100),
  activityId: optId,
});

export const incomeSchema = z
  .object({
    id: clientId,
    farmId: z.string().uuid(),
    plotId: optId,
    cropId: optId,
    harvestId: optId,
    source: z.enum(["SALE", "OTHER"]).default("SALE"),
    description: optStr(300),
    quantity: optNum(0),
    unit: optStr(20),
    pricePerUnit: optNum(0),
    grossAmount: optNum(0),
    transportCost: optNum(0),
    otherDeductions: optNum(0),
    amountReceived: optNum(0),
    buyer: optStr(100),
    market: optStr(100),
    date: dateStr,
    notes: optStr(1000),
  })
  .refine((d) => d.grossAmount != null || (d.quantity != null && d.pricePerUnit != null), {
    message: "Enter quantity and price, or the total amount",
    path: ["grossAmount"],
  });

export const harvestSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  plotId: optId,
  cropId: z.string().uuid({ message: "Choose a crop" }),
  date: dateStr,
  quantity: posNum("Enter the harvested quantity"),
  unit: reqStr(20),
  grade: optStr(60),
  storage: optStr(200),
  notes: optStr(1000),
});

// ---- inventory
export const inventoryItemSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  name: reqStr(120, "Enter the item name"),
  category: z.enum(INVENTORY_CATEGORIES),
  unit: reqStr(20),
  lowStockThreshold: optNum(0),
  expiryDate: optDate,
  supplier: optStr(120),
  storageNotes: optStr(500),
  // opening stock (recorded as a PURCHASE transaction)
  openingQuantity: optNum(0),
  openingUnitCost: optNum(0),
  recordExpense: z.boolean().optional(),
});

export const inventoryTxnSchema = z.object({
  id: clientId,
  itemId: z.string().uuid(),
  type: z.enum(["PURCHASE", "USAGE", "WASTAGE", "ADJUSTMENT"]),
  quantity: reqNum(0, "Enter the quantity"),
  unitCost: optNum(0),
  date: dateStr,
  supplier: optStr(120),
  notes: optStr(500),
  activityId: optId,
  recordExpense: z.boolean().optional(),
});

// ---- tasks
export const taskSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  plotId: optId,
  cropId: optId,
  title: reqStr(150, "Enter a task title"),
  category: z.enum(TASK_CATEGORIES),
  date: dateStr,
  time: z.preprocess(emptyToUndef, z.string().regex(/^\d{2}:\d{2}$/).optional()),
  description: optStr(1000),
  estimatedCost: optNum(0),
  actualCost: optNum(0),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PLANNED"),
  reminderDays: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).max(30).optional()),
  notes: optStr(1000),
  workerIds: z.array(z.string().uuid()).default([]),
});

// ---- soil
export const soilTestSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  plotId: optId,
  testDate: dateStr,
  laboratory: optStr(150),
  sampleId: optStr(60),
  soilType: optStr(80),
  ph: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(14).optional()),
  ec: optNum(0),
  organicCarbon: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(100).optional()),
  nitrogen: optNum(0),
  phosphorus: optNum(0),
  potassium: optNum(0),
  micronutrients: z.record(z.coerce.number().min(0)).optional(),
  notes: optStr(1000),
});

// ---- equipment
export const equipmentSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  name: reqStr(120, "Enter the equipment name"),
  category: reqStr(40),
  ownership: z.enum(["OWNED", "RENTED", "SHARED"]).default("OWNED"),
  purchaseDate: optDate,
  purchaseCost: optNum(0),
  status: z.enum(["WORKING", "NEEDS_REPAIR", "RETIRED"]).default("WORKING"),
  rentalInfo: optStr(300),
  notes: optStr(1000),
});

export const equipmentLogSchema = z.object({
  id: clientId,
  equipmentId: z.string().uuid(),
  type: z.enum(["MAINTENANCE", "REPAIR", "RENTAL", "USAGE"]),
  date: dateStr,
  cost: optNum(0),
  hours: optNum(0),
  description: optStr(500),
  nextDueDate: optDate,
  recordExpense: z.boolean().optional(),
});

// ---- crop issues
export const cropIssueSchema = z.object({
  id: clientId,
  farmId: z.string().uuid(),
  plotId: optId,
  cropId: optId,
  title: reqStr(150, "Give the issue a short title"),
  description: reqStr(3000, "Describe what you see"),
  symptoms: z.array(z.string().max(60)).default([]),
  affectedArea: optStr(100),
  startedOn: optDate,
  previousTreatments: optStr(1000),
  status: z.enum(["OPEN", "MONITORING", "RESOLVED"]).default("OPEN"),
  expertAdvice: optStr(3000),
  resolution: optStr(2000),
});

// ---- schemes / market / misc (user scoped)
export const schemeTrackerSchema = z.object({
  schemeId: z.string().uuid(),
  bookmarked: z.boolean().default(true),
  status: z.enum(["INTERESTED", "COLLECTING_DOCUMENTS", "APPLIED", "APPROVED", "REJECTED", "NOT_ELIGIBLE"]).default("INTERESTED"),
  collectedDocuments: z.array(z.string().max(200)).default([]),
  applicationRef: optStr(100),
  notes: optStr(2000),
  followUpDate: optDate,
});

export const priceAlertSchema = z.object({
  cropKey: reqStr(40),
  market: optStr(100),
  direction: z.enum(["ABOVE", "BELOW"]),
  threshold: posNum("Enter a price"),
});

export const inputProductSchema = z
  .object({
    name: reqStr(120, "Enter the product name"),
    category: reqStr(40),
    dose: optNum(0),
    doseUnit: z.preprocess(emptyToUndef, z.enum(["kg", "g", "l", "ml"]).optional()),
    doseBasis: z.preprocess(emptyToUndef, z.enum(["per_area", "per_litre", "per_plant"]).optional()),
    doseBasisArea: optNum(0),
    doseBasisUnit: optStr(20),
    cropKey: optStr(40),
    sourceReference: optStr(500),
    notes: optStr(1000),
  })
  .refine((d) => d.dose == null || (d.sourceReference && d.sourceReference.length >= 5), {
    message: "A saved dose must include where it came from (label, KVK, university recommendation…)",
    path: ["sourceReference"],
  });

export const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the person's KRSHI account email"),
  role: z.enum(["MANAGER", "FINANCE_VIEWER", "VIEWER"]),
});

export type FieldErrors = Record<string, string[] | undefined>;
