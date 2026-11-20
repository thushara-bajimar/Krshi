# KRSHI database

PostgreSQL, managed with Prisma (`prisma/schema.prisma`, migrations in `prisma/migrations`).

## Conventions

| Topic | Rule |
|---|---|
| Money | `Decimal(12,2)` in INR. Server arithmetic is in integer paise (`src/lib/calc/money.ts`). |
| Quantities / areas | `Decimal(14,3)` / `Decimal(12,4)`, always stored next to their unit (`AreaUnit` enum or a unit string). |
| Calendar dates | `@db.Date` (no time zone). The API exchanges `YYYY-MM-DD`; it is stored as UTC midnight and formatted in UTC. "Today" is computed in Asia/Kolkata. |
| Offline-capable records | Activity, LaborRecord, Expense, Income, Harvest, Task, InventoryItem have `version Int` (incremented on every change) and `deletedAt` (soft delete). Creates may supply a client UUID `id`. |
| Idempotency | `ProcessedMutation(id = client mutation UUID)` stores the status and response of each replayed write. |
| Ownership | Everything farm-related has `farmId → Farm` with `onDelete: Cascade`. Optional links (plot, crop, worker, activity, task) use `SetNull`. |
| Provenance | `MarketPrice` has `source`, `sourceUrl`, `priceDate`, `retrievedAt`, `dataKind` (LIVE / CACHED / SAMPLE). `WeatherCache` has `provider` and `fetchedAt`. `Scheme` and `Resource` have `sourceUrl`, `lastVerifiedAt` and `verificationNote`. |

## Model map

```
User ─┬─ UserSettings (1:1: notification prefs, voice language, current farm)
      ├─ Session (hashed tokens)
      ├─ FarmMembership ── Farm            role: OWNER | MANAGER | FINANCE_VIEWER | VIEWER
      ├─ SchemeTracker ── Scheme           personal application checklist / status
      ├─ MarketFavorite, PriceAlert
      ├─ InputProduct                      saved product + dose (dose requires a source)
      ├─ Notification                      unique (userId, dedupeKey)
      └─ ProcessedMutation

Farm ─┬─ Plot ── Crop (catalog; system crops + user-added)
      ├─ Activity ─┬─ Attachment
      │            ├─ InventoryTransaction (usage linked to the activity)
      │            └─ Expense / LaborRecord (optional links)
      ├─ Worker ── LaborRecord ── LaborPayment
      ├─ Expense ── Attachment (receipts)
      ├─ Harvest ── Income (sales linked to a harvest)
      ├─ InventoryItem ── InventoryTransaction (PURCHASE | USAGE | WASTAGE | ADJUSTMENT, signed delta)
      ├─ Task ── TaskWorker ── Worker
      ├─ SoilTest ── Attachment
      ├─ Equipment ── EquipmentLog ── Expense (optional)
      └─ CropIssue ── Attachment

Reference / external: Crop, Scheme, Resource, MarketPrice, WeatherCache
```

## Integrity rules enforced in code (`src/server/records/registry.ts`)

- Every referenced plot, worker, activity, task, harvest or inventory item must belong to the **same farm** as the record.
- Inventory stock never goes negative. Usage is checked and the quantity is updated with a compare-and-set update.
- Deleting an activity returns any stock it deducted, through a logged adjustment transaction.
- A sale linked to a harvest must use the harvest's unit and cannot exceed the unsold quantity.
- Labour `amountPaid` / `paymentStatus` are recomputed from `LaborPayment` rows, and payments cannot exceed the amount pending.
- Workers with work records cannot be deleted; they are deactivated instead.

## Finance definitions

- **Expenditure** = expenses (not deleted) + completed labour records (`totalCost`, by work date).
- **Income** = `Income.netAmount` (gross − transport − other deductions).
- **Recorded net** = income − expenditure. Reports label these as *recorded* figures because nothing is estimated.

## Commands

```bash
npm run db:migrate            # create/apply a migration in development
npx prisma migrate deploy     # apply migrations in production
npm run db:seed               # reference data + demo account (re-runnable)
npx prisma studio             # browse data
```
