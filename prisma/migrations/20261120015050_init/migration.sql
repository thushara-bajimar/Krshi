-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'kn');

-- CreateEnum
CREATE TYPE "AreaUnit" AS ENUM ('ACRE', 'CENT', 'HECTARE', 'SQ_M', 'GUNTA');

-- CreateEnum
CREATE TYPE "FarmRole" AS ENUM ('OWNER', 'MANAGER', 'FINANCE_VIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PlotStatus" AS ENUM ('ACTIVE', 'FALLOW', 'PREPARING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('FERTILIZER', 'PESTICIDE', 'FUNGICIDE', 'HERBICIDE', 'IRRIGATION', 'PRUNING', 'CLEANING', 'PLANTING', 'HARVESTING', 'SOIL_PREPARATION', 'PEST_MANAGEMENT', 'DISEASE_MANAGEMENT', 'EQUIPMENT_USAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('FERTILIZER', 'PESTICIDE', 'SEEDS', 'TOOLS', 'EQUIPMENT', 'IRRIGATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('PURCHASE', 'USAGE', 'WASTAGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('DAILY', 'HALF_DAY', 'HOURLY', 'TASK');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FERTILIZER', 'PESTICIDE', 'SEEDS', 'LABOR', 'MACHINERY', 'EQUIPMENT', 'IRRIGATION', 'ELECTRICITY', 'FUEL', 'TRANSPORT', 'MAINTENANCE', 'RENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DataKind" AS ENUM ('LIVE', 'CACHED', 'SAMPLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "language" "Language" NOT NULL DEFAULT 'en',
    "district" TEXT,
    "taluk" TEXT,
    "village" TEXT,
    "avatarPath" TEXT,
    "areaUnit" "AreaUnit" NOT NULL DEFAULT 'ACRE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "notifyTasks" BOOLEAN NOT NULL DEFAULT true,
    "notifyInventory" BOOLEAN NOT NULL DEFAULT true,
    "notifyPayments" BOOLEAN NOT NULL DEFAULT true,
    "notifyWeather" BOOLEAN NOT NULL DEFAULT true,
    "notifyPriceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "taskReminderDays" INTEGER NOT NULL DEFAULT 2,
    "voiceLanguage" TEXT NOT NULL DEFAULT 'en-IN',
    "currentFarmId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "taluk" TEXT,
    "village" TEXT,
    "location" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "totalArea" DECIMAL(12,4),
    "areaUnit" "AreaUnit" NOT NULL DEFAULT 'ACRE',
    "description" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmMembership" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FarmRole" NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKn" TEXT,
    "category" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" DECIMAL(12,4) NOT NULL,
    "areaUnit" "AreaUnit" NOT NULL DEFAULT 'ACRE',
    "cropId" TEXT,
    "variety" TEXT,
    "plantingDate" DATE,
    "plantCount" INTEGER,
    "soilType" TEXT,
    "irrigation" TEXT,
    "notes" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "PlotStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "cropId" TEXT,
    "type" "ActivityType" NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "productName" TEXT,
    "productCategory" TEXT,
    "quantity" DECIMAL(14,3),
    "quantityUnit" TEXT,
    "areaCovered" DECIMAL(12,4),
    "areaUnit" "AreaUnit",
    "dilution" TEXT,
    "waterQuantity" DECIMAL(14,3),
    "waterUnit" TEXT,
    "cost" DECIMAL(12,2),
    "laborDetails" TEXT,
    "notes" TEXT,
    "sourceReference" TEXT,
    "followUpDate" DATE,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "activityId" TEXT,
    "expenseId" TEXT,
    "soilTestId" TEXT,
    "issueId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dose" DECIMAL(14,4),
    "doseUnit" TEXT,
    "doseBasis" TEXT,
    "doseBasisArea" DECIMAL(12,4),
    "doseBasisUnit" TEXT,
    "cropKey" TEXT,
    "sourceReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InputProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "lowStockThreshold" DECIMAL(14,3),
    "expiryDate" DATE,
    "supplier" TEXT,
    "storageNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "delta" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "totalCost" DECIMAL(12,2),
    "date" DATE NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "activityId" TEXT,
    "expenseId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "category" TEXT NOT NULL,
    "defaultWage" DECIMAL(12,2),
    "wageType" "WageType" NOT NULL DEFAULT 'DAILY',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "workerId" TEXT,
    "workerLabel" TEXT,
    "workerCount" INTEGER NOT NULL DEFAULT 1,
    "taskCategory" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "wageType" "WageType" NOT NULL,
    "units" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "additionalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "workStatus" "WorkStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "activityId" TEXT,
    "taskId" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LaborRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborPayment" (
    "id" TEXT NOT NULL,
    "laborRecordId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "cropId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "paymentMethod" TEXT,
    "vendor" TEXT,
    "activityId" TEXT,
    "equipmentLogId" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "cropId" TEXT,
    "harvestId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SALE',
    "description" TEXT,
    "quantity" DECIMAL(14,3),
    "unit" TEXT,
    "pricePerUnit" DECIMAL(12,2),
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "transportCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "amountReceived" DECIMAL(12,2),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "buyer" TEXT,
    "market" TEXT,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Harvest" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "cropId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "grade" TEXT,
    "storage" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "cropId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "description" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),
    "status" "TaskStatus" NOT NULL DEFAULT 'PLANNED',
    "reminderDays" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskWorker" (
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "TaskWorker_pkey" PRIMARY KEY ("taskId","workerId")
);

-- CreateTable
CREATE TABLE "SoilTest" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "testDate" DATE NOT NULL,
    "laboratory" TEXT,
    "sampleId" TEXT,
    "soilType" TEXT,
    "ph" DECIMAL(4,2),
    "ec" DECIMAL(8,3),
    "organicCarbon" DECIMAL(6,3),
    "nitrogen" DECIMAL(10,2),
    "phosphorus" DECIMAL(10,2),
    "potassium" DECIMAL(10,2),
    "micronutrients" JSONB,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoilTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownership" TEXT NOT NULL DEFAULT 'OWNED',
    "purchaseDate" DATE,
    "purchaseCost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'WORKING',
    "rentalInfo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentLog" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cost" DECIMAL(12,2),
    "hours" DECIMAL(8,2),
    "description" TEXT,
    "nextDueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropIssue" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "cropId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "symptoms" TEXT[],
    "affectedArea" TEXT,
    "startedOn" DATE,
    "previousTreatments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "aiNotes" TEXT,
    "expertAdvice" TEXT,
    "resolution" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "district" TEXT,
    "description" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "crops" TEXT[],
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKn" TEXT,
    "department" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "categories" TEXT[],
    "crops" TEXT[],
    "districts" TEXT[],
    "description" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL,
    "eligibilityRules" JSONB,
    "benefits" TEXT NOT NULL,
    "documents" TEXT[],
    "applicationProcess" TEXT NOT NULL,
    "deadline" TEXT,
    "officialUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "bookmarked" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'INTERESTED',
    "collectedDocuments" TEXT[],
    "applicationRef" TEXT,
    "notes" TEXT,
    "followUpDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "cropKey" TEXT NOT NULL,
    "variety" TEXT NOT NULL DEFAULT '',
    "grade" TEXT NOT NULL DEFAULT '',
    "market" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "priceDate" DATE NOT NULL,
    "minPrice" DECIMAL(12,2) NOT NULL,
    "maxPrice" DECIMAL(12,2) NOT NULL,
    "modalPrice" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Rs/Quintal',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "dataKind" "DataKind" NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "MarketFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cropKey" TEXT NOT NULL,
    "market" TEXT,
    "direction" TEXT NOT NULL,
    "threshold" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherCache" (
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMutation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "status" INTEGER NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "FarmMembership_userId_idx" ON "FarmMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmMembership_farmId_userId_key" ON "FarmMembership"("farmId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_key_key" ON "Crop"("key");

-- CreateIndex
CREATE INDEX "Plot_farmId_idx" ON "Plot"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_farmId_name_key" ON "Plot"("farmId", "name");

-- CreateIndex
CREATE INDEX "Activity_farmId_date_idx" ON "Activity"("farmId", "date");

-- CreateIndex
CREATE INDEX "Activity_plotId_date_idx" ON "Activity"("plotId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storagePath_key" ON "Attachment"("storagePath");

-- CreateIndex
CREATE INDEX "Attachment_farmId_idx" ON "Attachment"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "InputProduct_userId_name_key" ON "InputProduct"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_farmId_name_key" ON "InventoryItem"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_expenseId_key" ON "InventoryTransaction"("expenseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_itemId_date_idx" ON "InventoryTransaction"("itemId", "date");

-- CreateIndex
CREATE INDEX "Worker_farmId_idx" ON "Worker"("farmId");

-- CreateIndex
CREATE INDEX "LaborRecord_farmId_date_idx" ON "LaborRecord"("farmId", "date");

-- CreateIndex
CREATE INDEX "LaborRecord_workerId_idx" ON "LaborRecord"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_equipmentLogId_key" ON "Expense"("equipmentLogId");

-- CreateIndex
CREATE INDEX "Expense_farmId_date_idx" ON "Expense"("farmId", "date");

-- CreateIndex
CREATE INDEX "Income_farmId_date_idx" ON "Income"("farmId", "date");

-- CreateIndex
CREATE INDEX "Harvest_farmId_date_idx" ON "Harvest"("farmId", "date");

-- CreateIndex
CREATE INDEX "Task_farmId_date_idx" ON "Task"("farmId", "date");

-- CreateIndex
CREATE INDEX "SoilTest_farmId_testDate_idx" ON "SoilTest"("farmId", "testDate");

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_slug_key" ON "Scheme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeTracker_userId_schemeId_key" ON "SchemeTracker"("userId", "schemeId");

-- CreateIndex
CREATE INDEX "MarketPrice_cropKey_priceDate_idx" ON "MarketPrice"("cropKey", "priceDate");

-- CreateIndex
CREATE INDEX "MarketPrice_district_idx" ON "MarketPrice"("district");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_cropKey_variety_grade_market_priceDate_source_key" ON "MarketPrice"("cropKey", "variety", "grade", "market", "priceDate", "source");

-- CreateIndex
CREATE UNIQUE INDEX "MarketFavorite_userId_kind_value_key" ON "MarketFavorite"("userId", "kind", "value");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ProcessedMutation_userId_createdAt_idx" ON "ProcessedMutation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMembership" ADD CONSTRAINT "FarmMembership_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMembership" ADD CONSTRAINT "FarmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_soilTestId_fkey" FOREIGN KEY ("soilTestId") REFERENCES "SoilTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "CropIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputProduct" ADD CONSTRAINT "InputProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRecord" ADD CONSTRAINT "LaborRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRecord" ADD CONSTRAINT "LaborRecord_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRecord" ADD CONSTRAINT "LaborRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRecord" ADD CONSTRAINT "LaborRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRecord" ADD CONSTRAINT "LaborRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborPayment" ADD CONSTRAINT "LaborPayment_laborRecordId_fkey" FOREIGN KEY ("laborRecordId") REFERENCES "LaborRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_equipmentLogId_fkey" FOREIGN KEY ("equipmentLogId") REFERENCES "EquipmentLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWorker" ADD CONSTRAINT "TaskWorker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWorker" ADD CONSTRAINT "TaskWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilTest" ADD CONSTRAINT "SoilTest_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilTest" ADD CONSTRAINT "SoilTest_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentLog" ADD CONSTRAINT "EquipmentLog_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropIssue" ADD CONSTRAINT "CropIssue_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropIssue" ADD CONSTRAINT "CropIssue_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropIssue" ADD CONSTRAINT "CropIssue_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeTracker" ADD CONSTRAINT "SchemeTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeTracker" ADD CONSTRAINT "SchemeTracker_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketFavorite" ADD CONSTRAINT "MarketFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedMutation" ADD CONSTRAINT "ProcessedMutation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
