import type { MarketPriceProvider, PriceRow } from "./types";
import { cropKeyFor } from "./types";

// data.gov.in (Open Government Data Platform India) — dataset published from AGMARKNET:
// "Current Daily Price of Various Commodities from Various Markets (Mandi)".
// Requires a free API key. Licence: Government Open Data License – India (GODL).
// The dataset only exposes the latest reported day; KRSHI builds history by storing each retrieval.
const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const BASE = `https://api.data.gov.in/resource/${RESOURCE_ID}`;

function parseDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s?.trim() ?? "");
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
}

export const dataGovProvider: MarketPriceProvider = {
  id: "data.gov.in-agmarknet",
  name: "AGMARKNET via data.gov.in",
  sourceUrl: `https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi`,
  live: true,
  isConfigured: () => !!process.env.DATA_GOV_IN_API_KEY,
  async fetchLatest({ state, districts }) {
    const key = process.env.DATA_GOV_IN_API_KEY;
    if (!key) throw new Error("DATA_GOV_IN_API_KEY is not set");
    const rows: PriceRow[] = [];
    const targets = districts?.length ? districts : [undefined];
    for (const district of targets) {
      let offset = 0;
      for (let page = 0; page < 10; page++) {
        const url = new URL(BASE);
        url.searchParams.set("api-key", key);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "500");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("filters[state]", state);
        if (district) url.searchParams.set("filters[district]", district);
        const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
        if (!res.ok) throw new Error(`data.gov.in responded ${res.status}`);
        const j = await res.json();
        const records: Record<string, string>[] = j.records ?? [];
        for (const r of records) {
          const cropKey = cropKeyFor(r.commodity ?? "");
          const date = parseDate(r.arrival_date);
          const min = Number(r.min_price), max = Number(r.max_price), modal = Number(r.modal_price);
          if (!cropKey || !date || !Number.isFinite(modal) || modal <= 0) continue; // skip unmapped / malformed rows
          rows.push({
            commodity: r.commodity, cropKey, variety: r.variety ?? "", grade: r.grade ?? "", market: r.market, district: r.district,
            state: r.state, priceDate: date, minPrice: min, maxPrice: max, modalPrice: modal, unit: "Rs/Quintal",
          });
        }
        if (records.length < 500) break;
        offset += 500;
      }
    }
    return rows;
  },
};
