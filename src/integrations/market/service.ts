import "server-only";
import { prisma } from "@/lib/db";
import { dataGovProvider } from "./datagov";

const REFRESH_MS = 6 * 60 * 60 * 1000;
export const MARKET_STATE = "Karnataka";
export const MARKET_DISTRICTS = ["Dakshina Kannada", "Udupi", "Uttara Kannada", "Shivamogga", "Kodagu", "Chikmagalur", "Hassan"];

export const SAMPLE_SOURCE = "KRSHI sample dataset (illustrative — not real prices)";

export function marketProviderStatus() {
  return {
    live: dataGovProvider.isConfigured(),
    name: dataGovProvider.name,
    sourceUrl: dataGovProvider.sourceUrl,
  };
}

/** Refresh live prices if a provider is configured and the last retrieval is older than REFRESH_MS. */
export async function maybeRefreshMarketPrices(force = false): Promise<{ refreshed: boolean; error?: string; count?: number }> {
  if (!dataGovProvider.isConfigured()) return { refreshed: false };
  const last = await prisma.marketPrice.findFirst({ where: { source: dataGovProvider.name }, orderBy: { retrievedAt: "desc" }, select: { retrievedAt: true } });
  if (!force && last && Date.now() - last.retrievedAt.getTime() < REFRESH_MS) return { refreshed: false };
  try {
    const rows = await dataGovProvider.fetchLatest({ state: MARKET_STATE, districts: MARKET_DISTRICTS });
    const now = new Date();
    for (const r of rows) {
      const data = { ...r, source: dataGovProvider.name, sourceUrl: dataGovProvider.sourceUrl, dataKind: "LIVE" as const, retrievedAt: now };
      await prisma.marketPrice.upsert({
        where: { cropKey_variety_grade_market_priceDate_source: { cropKey: r.cropKey, variety: r.variety, grade: r.grade, market: r.market, priceDate: r.priceDate, source: dataGovProvider.name } },
        update: { minPrice: r.minPrice, maxPrice: r.maxPrice, modalPrice: r.modalPrice, retrievedAt: now },
        create: data,
      });
    }
    return { refreshed: true, count: rows.length };
  } catch (e) {
    console.warn("[market] refresh failed:", (e as Error).message);
    return { refreshed: false, error: (e as Error).message };
  }
}
