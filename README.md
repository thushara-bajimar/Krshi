# KRSHI

KRSHI is a farm-management and agricultural-information web app built for farmers in **Dakshina Kannada and Udupi** (coastal Karnataka). It brings the farm notebook, labour book and account book into one mobile-first app, with market prices, weather and government schemes alongside. Every external figure is shown with its source and date.

It covers arecanut, coconut, paddy, pepper, cashew, banana, cocoa, rubber, vegetables and user-added crops, and works on weak or missing connectivity.

---

## Contents

1. [Features](#features)
2. [Tech stack & architecture](#tech-stack--architecture)
3. [Folder structure](#folder-structure)
4. [Getting started](#getting-started)
5. [Environment variables](#environment-variables)
6. [Database](#database)
7. [Testing](#testing)
8. [External integrations](#external-integrations)
9. [Offline support](#offline-support)
10. [Security & privacy](#security--privacy)
11. [Deployment](#deployment)
12. [Known limitations](#known-limitations)
13. [Future improvements](#future-improvements)

More detail: [docs/DATABASE.md](docs/DATABASE.md) · [docs/API.md](docs/API.md) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Features

| Module | What it does |
|---|---|
| **Accounts** | Email/password registration and login, sessions stored in the database, profile (district/taluk/village, language, area unit), password change that signs out other devices, account deletion. |
| **Farms & plots** | Multiple farms, plots with crop, variety, planting date (crop age), plant count, soil, irrigation, status. Optional map location on OpenStreetMap (tap the map, use GPS or type coordinates). |
| **Activity diary** | 14 activity types with product, quantity, area, dilution, water, cost, who did the work, recommendation source, follow-up date and photo/PDF attachments. Search and filters, per-plot timelines. An entry can **deduct inventory** and **create a linked expense** in the same database transaction. |
| **Input calculator** | Scales a dose the farmer enters (per area, per litre of spray or per plant) to the plot: product quantity, water, cost and stock shortfall, showing each step of the working. **It never supplies a dose**, a source is required before the result can be saved, and the result can be recorded as an activity. Product and dose references can be saved, but only together with their source. |
| **Labour** | Worker register; daily, half-day, hourly and per-task wages; several workers at once (one record per named worker); manual total adjustment; extra costs; part payments; pending-wage list; charts by month, worker, plot and crop; planned vs completed work. |
| **Finance** | Expenses in 13 categories with receipts, crop sales with transport and commission deductions, other income, amounts still to receive. Dashboard of income vs expenditure, category, crop and plot breakdowns, labour vs inputs, and comparison with the previous period. All totals are computed from stored records. |
| **Inventory** | Items with stock history (purchase, usage, wastage, count correction), low-stock and expiry alerts, purchase-to-expense linking, safe reversal. |
| **Harvests** | Harvest records with linked sales (sales that exceed the harvested quantity are blocked), remaining stock, yield per acre, cost per unit. |
| **Calendar & tasks** | Month and week views, task status, assigned workers, estimated/actual cost, reminders, rain warnings for spray/fertilizer days, and a "same time last year" planner built from the farmer's own diary (no hard-coded crop schedules). |
| **Market prices** | Latest prices by market, 7/30/90-day trends, comparison of up to 4 markets, a net-after-transport comparison, favourite crops/markets, price alerts. Every row carries source, date and a LIVE or SAMPLE label. |
| **Weather** | Current conditions and 7-day forecast at the farm's location, IMD rainfall categories, strong-wind warnings, forecast context for planned tasks, links to IMD, IMD Agromet and KSNDMC. |
| **Government schemes** | 13 curated central and Karnataka schemes with official links and verification status, filters, a relevance checker that compares answers with published basic criteria (it never decides eligibility), and a personal application tracker with document checklist. |
| **Soil health** | Manual entry of lab or Soil Health Card results, report upload, trend charts per plot, explanations of each parameter (no invented ratings or doses). |
| **Crop issues** | Issue reports with photos, symptoms, timeline and treatments already tried. Optional AI observations explicitly say they are not a diagnosis and never name chemicals. Space to record expert advice, plus a directory of institutions and the Kisan Call Centre. |
| **Equipment** | Maintenance, repair, rental and usage log, next-service dates, optional linked expenses. |
| **Farm sharing** | Owner, Farm manager, Finance viewer and Viewer roles, all enforced on the server. Viewers cannot see money or wages, and non-members get "not found". |
| **Reports** | Farm-performance, expense, labour, crop, income, harvest, activity and inventory reports for a month, season, financial year or custom range, filtered by farm, plot and crop. Printable (save as PDF) and CSV export. |
| **Notifications** | Generated from real records: due/overdue tasks, diary follow-ups, low stock, expiry, unpaid wages, heavy-rain and wind warnings, price alerts, scheme follow-ups. Read/unread, dismiss, per-type preferences. |
| **Assistant (voice & text)** | English and Kannada. Records are prepared as a pre-filled form for the farmer to check, never saved directly. Answers come from the database. A built-in rule parser works with no API key; Claude is used for parsing when `ANTHROPIC_API_KEY` is set. Voice input uses the browser's Web Speech API (`en-IN`, `kn-IN`), with optional read-aloud. |
| **Offline** | PWA with service worker, cached pages labelled with when they were saved, an IndexedDB write queue, idempotent sync, conflict detection and resolution UI. |
| **Languages** | English and Kannada interface (navigation, quick actions, dashboard, crop and activity names). |

---

## Tech stack & architecture

- **Next.js 15** (App Router, React 19, TypeScript, strict mode). Server Components read data directly; mutations go through JSON route handlers, which is what makes offline replay possible.
- **PostgreSQL + Prisma 6.** Money is `Decimal(12,2)` and quantities `Decimal(14,3)`; arithmetic is done in integer paise.
- **Tailwind CSS v4** with a custom design system (`src/components/ui`), accessible Radix Dialog, lucide icons and sonner toasts.
- **Recharts** charts. The palette was checked with a colour validator (lightness, chroma, colour-blind separation, contrast).
- **Leaflet + OpenStreetMap** maps, loaded on the client only.
- **Zod** schemas shared by client forms and the server.
- **Auth:** bcrypt (cost 12) password hashes. Sessions use random 256-bit tokens, stored only as SHA-256 hashes, in httpOnly SameSite cookies with sliding 30-day expiry.
- **AI (optional):** Anthropic SDK, server-side only, structured outputs validated with Zod, server-side refusal fallbacks, rule-based fallback.
- **Offline:** hand-written service worker plus IndexedDB (`idb`).

### Write path (the core design)

```
Form (client, Zod validation)
  → submitRecord()  ── offline? ──► IndexedDB queue ──(online)──► replay
  → POST/PATCH/DELETE /api/records/:entity[/:id]   (X-Mutation-Id header)
      → mutateRecord()  [one DB transaction]
          1. idempotency: replayed mutation id → stored response
          2. authorization: farm role must grant read/write/finance permission
          3. idempotent create: client-supplied UUID already exists → return it
          4. optimistic concurrency: PATCH with stale baseVersion → 409 + server copy
          5. entity handler (registry): validates cross-farm references, side effects
             (inventory deduction, linked expense, payment status, harvest limits)
```

Each entity is defined once in `src/server/records/registry.ts` with its schema, sensitivity (finance or not), load/create/update/remove handlers and side effects.

Reads on pages use `pageContext()`, which gives the current user, their farms, the selected farm, the role and permissions. Every query is scoped to a farm the user belongs to.

---

## Folder structure

```
prisma/              schema.prisma, migrations/, seed.ts, seed-data.ts (crops, schemes, resources, sample prices)
public/              sw.js (service worker), manifest.webmanifest, icon.svg
scripts/db.mjs       local PostgreSQL via embedded-postgres (no install needed)
src/
  app/
    page.tsx               landing page
    (auth)/                login, register
    app/                   the application (dashboard + all modules)
    api/                   route handlers (auth, records, farms, uploads, assistant, market, reports, …)
    offline/               offline fallback page
  components/
    ui/                    design system (button, field, card, dialog, misc, confirm)
    app/                   shell, navigation, quick actions, app-data context, filters
    forms/                 generic RecordForm / FormDialog, delete button, attachments
    charts.tsx, map/       Recharts & Leaflet components
  features/                module-specific client components (forms, calculator, assistant, …)
  integrations/            weather/ (Open-Meteo, advisories) · market/ (data.gov.in AGMARKNET)
  lib/
    calc/                  pure, tested domain maths (units, dosage, labour, finance, inventory, yield)
    validation/schemas.ts  shared Zod schemas
    auth/, authz.ts        sessions, passwords, role permissions
    assistant/parse.ts     rule-based NL parser (English + Kannada keywords)
    i18n/                  English / Kannada dictionary
  offline/                 IndexedDB queue, submitRecord, SyncProvider, sync centre UI
  server/                  record registry & service, finance aggregation, notifications, reports, storage
tests/
  unit/                    calculators, conversions, finance, labour, validation, schemes, parser
  integration/             record service against PostgreSQL (transactions, sync, authorization)
  e2e/smoke.mjs            browser test with an installed Chrome (desktop, mobile, offline round-trip)
docs/                      database, API, integration and deployment docs
```

---

## Getting started

Requirements: **Node.js 20+** (developed on Node 24) and npm. PostgreSQL is optional, because a local server can be started from npm.

```bash
npm install
cp .env.example .env                 # defaults work with the embedded database

# Terminal 1: local PostgreSQL 18 on port 5433 (data in ./.pgdata). Skip if you have your own Postgres.
npm run db:start

# Terminal 2
npx prisma migrate deploy            # or: npm run db:migrate (development)
npm run db:seed                      # reference data + demo account
npm run dev                          # http://localhost:3000
```

**Demo login:** `demo@krishi.app` / `krishi-demo-2026`. A second demo user, `manager@krishi.app` (same password), has the *Farm manager* role on the first farm, to show sharing. All demo records are marked as demo/illustrative. Set `SEED_DEMO=false` to seed reference data only.

> npm 11 blocks dependency install scripts by default. This repo's `package.json` already approves the ones needed (Prisma engines, esbuild, embedded-postgres binaries). If you see an `allow-scripts` warning, run `npm approve-scripts` for those packages.

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development / production build / production server |
| `npm run db:start` | Start embedded PostgreSQL (creates `krishi` and `krishi_test` databases) |
| `npm run db:migrate` / `db:deploy` / `db:reset` | Prisma migrations |
| `npm run db:seed` | Seed reference data and the demo account (re-runnable) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit + integration tests (Vitest) |

---

## Environment variables

See [`.env.example`](.env.example). No secrets are committed.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | for tests | Separate database for integration tests (its name must contain `test`) |
| `APP_URL` | no | Public base URL |
| `DATA_GOV_IN_API_KEY` | no | Enables live AGMARKNET mandi prices. Without it, labelled SAMPLE data is shown. |
| `ANTHROPIC_API_KEY` | no | Enables Claude for assistant parsing and crop-issue photo observations. Without it, the rule parser is used. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5` |
| `UPLOAD_DIR` | no | Where uploaded files are stored (default `./uploads`, outside `public/`) |

---

## Database

PostgreSQL schema in `prisma/schema.prisma`, about 30 models with foreign keys, unique constraints and indexes on farm/date. See **[docs/DATABASE.md](docs/DATABASE.md)** for the model map and conventions:

- Records that can be created offline accept a **client-generated UUID** and carry an integer **`version`** for conflict detection. They are **soft-deleted** (`deletedAt`).
- Every external data row (market prices, weather cache) stores its **source, source URL, data date, retrieval time and kind** (LIVE / CACHED / SAMPLE).
- `ProcessedMutation` is the idempotency log for replayed offline writes.

---

## Testing

```bash
npm run db:start         # integration tests need PostgreSQL (uses the krishi_test database)
npm test                 # 64 tests: 48 unit + 16 integration
npm run build && npm start
node tests/e2e/smoke.mjs ./test-results   # browser test (uses installed Chrome; BROWSER_CHANNEL=msedge for Edge)
```

**Unit tests:**
- area and quantity conversions (exact definitions, round trips, mass vs volume)
- the dosage calculator (per area, per litre, per plant, cost, shortfall, validation)
- labour totals and payment status
- money arithmetic without floating-point drift
- finance totals, monthly series, sale net amounts, financial year and seasons
- inventory deltas, yield
- scheme relevance checks
- Zod validation
- the assistant parser (English and Kannada)

**Integration tests**, run against PostgreSQL:
- transactional activity, inventory and expense writes, with rollback
- stock return when an activity is deleted
- idempotent creates and mutation replay
- version and deleted-record conflicts
- role permissions (viewer, finance viewer, manager, non-member)
- rejection of cross-farm references
- multi-worker labour and payments
- harvest-linked sales that would oversell
- finance aggregation matching the raw tables
- password hashing and session-token hashing

**Browser e2e test** (`tests/e2e/smoke.mjs`):
- login, and all main pages on desktop
- no horizontal overflow at 390 px phone width
- adding an expense through the mobile quick-add sheet
- an offline round trip: the diary loads offline from the service-worker cache, an activity is queued in IndexedDB, it syncs when back online, and exactly one copy exists on the server.

---

## External integrations

Summary below; full research notes, endpoints and procedures are in **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)**.

| Data | Provider | Status |
|---|---|---|
| Weather forecast | **Open-Meteo** (no key; free for non-commercial use) | **Live**, verified working. Cached 30 min in Postgres; marked *Cached* when the provider is unreachable. |
| Weather warnings | Derived from the forecast using IMD rainfall categories | Live (computed) |
| IMD / Agromet advisories | IMD, IMD Agromet, KSNDMC | **Links only.** No open API is available. |
| Mandi prices | **AGMARKNET via data.gov.in** (resource `9ef84268-…`) | **Implemented but not verified live**: needs `DATA_GOV_IN_API_KEY`, which was not available here. Without a key, a **clearly labelled SAMPLE dataset** is shown. |
| Government schemes | Curated directory with official portal links | Curated summaries marked *not yet verified against source*. No scraping. |
| Soil Health Card | soilhealth.dac.gov.in | Link. Results are entered manually (no public API). |
| Maps | OpenStreetMap tiles via Leaflet | Live |
| AI assistant / photo observations | Anthropic Claude | Implemented, optional, **not exercised here** (no key). The rule-based parser is the working default. |
| Voice | Browser Web Speech API | Depends on browser. Kannada (`kn-IN`) was **not tested on a device**. Tulu is not supported. |

---

## Offline support

- **Service worker** (`public/sw.js`):
  - App pages and React Server Component payloads are fetched network-first with a 4-second timeout, falling back to the cache.
  - Static assets are cache-first.
  - API responses are never cached.
  - The page cache and the IndexedDB queue are cleared on sign-out. If unsynced entries exist, the user is warned first.
- **Stale data is labelled:** an offline banner shows when the visible data was saved.
- **Offline writes** are possible for activities, expenses, labour, payments, harvests, sales, tasks and stock movements. They are queued in IndexedDB with a client UUID and a mutation id, so a replay can never duplicate a record. The queue is retried with exponential backoff, in order.
- **Conflicts:** edits carry the version they started from. If the server copy is newer, or was deleted, the edit is held as a conflict. The *Offline & sync* page shows a field diff with "keep mine" / "keep server". Nothing is overwritten silently.
- **Online only:** creating farms, sharing, photo uploads, market prices, weather refresh, schemes and the assistant.

---

## Security & privacy

- Authorization runs on the server for every read and write, by farm role. Non-members receive 404 so a farm's existence is not revealed.
- Every foreign id in a payload (plot, worker, activity, task, harvest, inventory item) is checked to belong to the same farm.
- Zod validation on client and server, Prisma parameterised queries, and per-user and per-IP rate limits on writes, login, registration, the assistant and AI calls.
- Uploads:
  - limited to 5 MB and 10 per record
  - type detected from file content (magic bytes), not the extension
  - random file names, stored outside `public/`
  - served only after an authorization check, with `nosniff` and a sandbox CSP
- Security headers: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Data minimisation: phone and village are optional, and farm location is optional and never public. Logging avoids personal data.

---

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. In short:
1. Provision managed PostgreSQL.
2. Set the environment variables.
3. Run `npm ci && npx prisma migrate deploy && npm run build && npm start` on any Node 20+ host (VM, Render, Railway, Fly.io, or a container).
4. Use persistent storage for `UPLOAD_DIR`, or swap `src/server/storage.ts` for S3-compatible storage on serverless hosts.

---

## Known limitations

- **Live market prices are untested.** The data.gov.in integration follows the published dataset schema but was not run with a real key. The sample data is illustrative only.
- **Scheme and resource summaries are not verified against source.** They were written from public knowledge and show "not yet verified". A person should check each against the official page and set `lastVerifiedAt`.
- **The AI paths (Claude parsing, photo observations) are not exercised** in this environment. Behaviour without a key is tested.
- **Kannada coverage is partial:** navigation, quick actions, dashboard, crop and activity names. Long-form content (scheme text, help) is English. Kannada voice recognition depends on the browser and was not tested on a real device.
- **Rate limiting is in-memory** (per instance). Use a shared store when scaling horizontally.
- **Files are stored on local disk.** Serverless hosts need an object-storage adapter.
- **PDF output uses the browser's print-to-PDF** from a print-optimised page. There is no server-side PDF generation.
- **No email or SMS:** farm sharing works with existing accounts, there is no password-reset email, and notifications appear in the app only (no push).
- **Offline:** pages not visited before cannot open offline, and the offline queue is per device.
- **No dark theme.**

## Future improvements

Server-side PDF and WhatsApp sharing of reports · password reset by OTP or email · web push reminders · verified scheme data with a review workflow · live APMC/cooperative arecanut prices (e.g. CAMPCO) once licensed sources are available · full Kannada translation and Kannada TTS voices · offline caching of farm reference lists for brand-new devices · object storage for uploads · equipment-sharing directory between farmers · crop-calendar templates approved by KVK / UAHS.

---

## Licence

Copyright © 2026 Thushara B S. **All rights reserved.** This repository is public for viewing only; no permission is granted to use, copy, modify or distribute the code without written permission. See [LICENSE](LICENSE). Third-party packages and fonts remain under their own licences.
