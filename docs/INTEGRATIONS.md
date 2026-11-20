# External data integrations

KRSHI never fabricates external data. Every provider sits behind a small interface, and every stored row records where it came from and when.

| Kind label | Meaning |
|---|---|
| **LIVE** | Fetched from the provider on this request or within its refresh window |
| **CACHED** | The provider could not be reached; the last stored copy is shown with its fetch time |
| **SAMPLE** | Illustrative data shipped for demo/testing. Always shown with a red "Sample" label and never mixed with live rows |
| **USER** | Entered by the farmer |
| **CURATED** | Written by the KRSHI team from public sources, with a verification status |

## Weather — Open-Meteo (live)

- Endpoint: `https://api.open-meteo.com/v1/forecast` (no key). Verified working from this environment on 2026-11-20.
- Fields: current temperature, humidity, precipitation, WMO weather code, wind; 7-day max/min temperature, precipitation sum, max precipitation probability, max wind. Timezone Asia/Kolkata.
- Terms: free for **non-commercial** use (under 10,000 calls/day). A commercial deployment needs an Open-Meteo subscription (<https://open-meteo.com/en/terms>), or a swap of the provider in `src/integrations/weather/` (the `WeatherProvider` interface).
- Caching: `WeatherCache` keyed by provider and coordinates rounded to 0.01°, 30-minute TTL. If the provider fails, the cached copy is shown and marked stale.
- Location: the farm's map point, or else the district headquarters (shown as "district centre").
- Derived warnings (`src/integrations/weather/advisory.ts`) use IMD 24-hour rainfall terms: heavy 64.5–115.5 mm, very heavy 115.6–204.4 mm, extremely heavy ≥ 204.5 mm. Strong wind is flagged at ≥ 40 km/h. Task context reports rain on or after a planned spraying or fertilizer day and refers the farmer to the product label. It **never recommends products or doses**.

### IMD / Agromet (links only)

The IMD APIs need IP whitelisting by IMD and are not openly available. District Agromet Advisory bulletins are published as documents. KRSHI therefore links to <https://mausam.imd.gov.in/>, <https://www.imdagrimet.gov.in/> and KSNDMC <https://www.ksndmc.org/> instead of copying them.

To integrate later: obtain IMD API access, implement a `WeatherProvider` or an advisory provider, and keep the provenance fields.

## Market prices — AGMARKNET via data.gov.in (implemented, needs key)

- Dataset: *Current Daily Price of Various Commodities from Various Markets (Mandi)*, resource id `9ef84268-d588-465a-a308-a864a43d0070`, published on the Open Government Data Platform India under the Government Open Data License – India.
- Access: a **free API key** from <https://data.gov.in> (register → My Account → API key). Without a key the API returns `Authorization field missing` (confirmed on 2026-11-20).
- Request: `GET https://api.data.gov.in/resource/<id>?api-key=…&format=json&limit=500&offset=…&filters[state]=Karnataka&filters[district]=…`
- Fields used: `state, district, market, commodity, variety, grade, arrival_date (dd/mm/yyyy), min_price, max_price, modal_price`. Unit: ₹ per quintal.
- Update frequency: daily, for markets that report; many markets skip days. The resource only exposes the **latest** reported day, so KRSHI builds history by storing each retrieval (upsert on crop, variety, grade, market, date and source).
- Refresh: at most every 6 hours when the market page is opened, or manually with *Refresh*. Districts fetched: Dakshina Kannada, Udupi, Uttara Kannada, Shivamogga, Kodagu, Chikmagalur, Hassan.
- Commodity mapping: `src/integrations/market/types.ts` (`COMMODITY_MAP`). Rows that don't map are dropped, never guessed.
- **Verification status:** implemented against the documented field names, but **not executed with a real key** in this build. After adding a key, open the market page and check that rows show `Live` and sensible ₹/quintal values. Note that some markets report arecanut under varieties such as *Rashi*, *Chali* or *Bette*.
- Other relevant sources not integrated: Karnataka's *Krishi Marata Vahini* (state APMC prices), and CAMPCO / private arecanut rates, which have no open API. Integrate only with permission from the publisher.

### SAMPLE dataset

`prisma/seed.ts` generates about 3,500 rows of illustrative prices (120 days, 10 coastal markets, a deterministic random walk) with `dataKind = SAMPLE` and source "KRSHI sample dataset (illustrative — not real prices)". The UI shows a warning banner and a "Sample" badge everywhere these rows appear, including notifications and assistant answers.

## Government schemes (curated)

- 13 schemes in `prisma/seed-data.ts`, each with official portal, department, summary, eligibility summary, benefits, documents and application process.
- Each entry has `lastVerifiedAt = null` and a note saying it has **not been verified against the official page in this build**. To verify one: open the official URL, check every field, update the seed (or the database), and set `lastVerifiedAt` and `verificationNote`.
- `eligibilityRules` hold a machine-checkable subset (e.g. `landholder`, `smallMarginal`, `minAge`, `maxAge`, `crop`) used by the relevance checker, which only reports "fits the published basics / does not fit / need more information".
- No scraping and no authenticated portals. KRSHI never submits applications and never claims an official status.

## Soil Health Card

The portal (<https://soilhealth.dac.gov.in/>) does not offer a public data API. Farmers enter values from their card or lab report and attach a photo or PDF. No ratings or doses are computed.

## Resources directory

Institutions only (KVKs, ICAR institutes, boards, departments, portals). The only phone number listed is the national Kisan Call Centre, 1800-180-1551. Individual officers and unverified contact details are deliberately not included.

## AI — Anthropic Claude (optional)

- Server-side only (`src/server/assistant/ai.ts`, `src/app/api/issues/[id]/assist/route.ts`). The key is read from `ANTHROPIC_API_KEY` and never sent to the browser.
- Assistant: structured output (Zod schema) that only **extracts** intent and fields. IDs returned by the model are checked against the farm's own plots and workers. Answers are always computed from the database, and records are saved only after the farmer confirms the pre-filled form. On error, rate limit or refusal, it falls back to the rule parser.
- Crop issue photos: the prompt forbids diagnosis certainty, product names and doses. The output is stored with a timestamp and the note "Not a diagnosis".
- Model: `ANTHROPIC_MODEL` (default `claude-opus-5-5`), with server-side refusal fallbacks enabled.

## Voice

Uses the browser's Web Speech API (`SpeechRecognition`, `speechSynthesis`). In Chrome, audio is processed by Google's speech service. English (`en-IN`) works where the browser supports it. Kannada (`kn-IN`) is offered but **was not tested on a device here**. Tulu has no browser recognition support and is not claimed.
