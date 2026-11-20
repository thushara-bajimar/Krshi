# KRSHI HTTP API

All endpoints are under `/api`, use JSON, and need a session cookie unless noted. Errors have the form `{ "error": string, "fieldErrors"?: { field: string[] } }` with status 400 (validation), 401, 403, 404, 409 (conflict / duplicate), 429 (rate limit) or 500.

## Auth & account

| Method & path | Body | Notes |
|---|---|---|
| `POST /api/auth/register` | `{ name, email, password, phone?, district?, language }` | Public. Rate-limited per IP. Starts a session. |
| `POST /api/auth/login` | `{ email, password }` | Public. Rate-limited per IP + email. |
| `POST /api/auth/logout` | — | |
| `POST /api/auth/password` | `{ currentPassword, newPassword, confirmPassword }` | Signs out the user's other sessions. |
| `GET/PATCH/DELETE /api/me` | `{ profile?, settings? }` | DELETE removes the account and the farms it owns. |

## Farms & sharing

| Method & path | Notes |
|---|---|
| `GET/POST /api/farms` | List / create (creator becomes OWNER). |
| `PATCH/DELETE /api/farms/:id` | Needs `write` / `manage`. |
| `POST /api/farms/select` | `{ farmId }`: set the active farm. |
| `GET/POST/PATCH/DELETE /api/farms/:id/members` | Share by account email with role MANAGER, FINANCE_VIEWER or VIEWER. Only the owner manages members; a member can remove themselves. |
| `GET/POST /api/crops` | Crop catalog / add a crop. |

## Generic records API (offline-safe)

`entity` ∈ `plot, activity, worker, labor, laborPayment, expense, income, harvest, inventoryItem, inventoryTxn, task, soilTest, equipment, equipmentLog, cropIssue`

| Method & path | Body | Behaviour |
|---|---|---|
| `GET /api/records/:entity?farmId=…[&since=ISO]` | — | List (up to 300). With `since`, returns changes including tombstones. |
| `POST /api/records/:entity` | entity payload (may include a client `id` UUID) | 201 created. 200 `{ duplicate: true }` if that id already exists. |
| `PATCH /api/records/:entity/:id` | `{ data, baseVersion? }` | 409 `{ conflict: "version", server }` if stale; 409 `{ conflict: "deleted" }` if deleted. |
| `DELETE /api/records/:entity/:id` | — | Soft delete where supported. Side effects are reversed (e.g. stock). |

Header **`X-Mutation-Id: <uuid>`** makes any write idempotent: a replay returns the stored response with `replayed: true`.

Permissions: finance entities (`labor`, `laborPayment`, `expense`, `income`) need `finance:read` / `finance:write` (OWNER, MANAGER; FINANCE_VIEWER can read). Everything else needs `read` / `write`. Non-members get 404.

Side-effect fields:
- `activity.recordExpense` and `activity.inventoryItemId` + `inventoryQuantity`
- `inventoryItem.openingQuantity` + `openingUnitCost` + `recordExpense`
- `inventoryTxn.recordExpense` (on purchases)
- `labor.workerIds[]` (one record per worker), `labor.amountPaid` and `labor.totalOverride`
- `equipmentLog.recordExpense`

## Other

| Method & path | Notes |
|---|---|
| `POST /api/uploads` (multipart: `file`, `target` ∈ activity, expense, soilTest, issue, `targetId`) | ≤ 5 MB, JPEG/PNG/WebP/PDF detected from content, ≤ 10 per record. |
| `GET/DELETE /api/uploads/:id` | Served only to authorised farm members. |
| `POST /api/assistant` `{ text }` | Returns `{ intent, text, items?, sources?, draft?, parser }`. Never saves records itself. |
| `POST /api/issues/:id/assist` | AI photo observations (only when `ANTHROPIC_API_KEY` is set). |
| `GET /api/reports/csv?type=&period=&from=&to=&farm=&plot=&crop=` | CSV with a UTF-8 BOM. |
| `POST /api/market/favorites` `{ kind, value }` | Toggle a favourite. |
| `GET/POST/DELETE /api/market/alerts` | Price alerts. |
| `POST /api/market/refresh` | Force a live refresh (when a key is configured). |
| `PUT/DELETE /api/schemes/tracker` | Personal scheme tracker. |
| `GET/POST /api/input-products`, `DELETE /api/input-products/:id` | Saved product/dose references (a dose requires a source). |
| `PATCH /api/notifications` `{ ids? , all?, action: read, unread or dismiss }` | |
