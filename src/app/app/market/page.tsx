import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { marketProviderStatus, maybeRefreshMarketPrices, SAMPLE_SOURCE } from "@/integrations/market/service";
import { PageHeader, Badge, EmptyState, Notice, Provenance } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { UrlFilters } from "@/components/app/url-filters";
import { PriceTrendChart } from "@/components/charts";
import { FavoriteToggle, NetComparison, PriceAlerts, RefreshPrices } from "@/features/market/market-client";
import { date, dateTime, isoDay, money, todayISO } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Market prices" };
const MARKET_CROPS = ["arecanut", "coconut", "paddy", "pepper", "cashew", "banana", "cocoa", "rubber", "vegetables"];

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  const sp = await searchParams;
  const status = marketProviderStatus();
  const refresh = await maybeRefreshMarketPrices();
  const favs = await prisma.marketFavorite.findMany({ where: { userId: ctx.user.id } });
  const favCrops = favs.filter((f) => f.kind === "CROP").map((f) => f.value);
  const favMarkets = favs.filter((f) => f.kind === "MARKET").map((f) => f.value);
  const cropKey = sp.crop && MARKET_CROPS.includes(sp.crop) ? sp.crop : favCrops[0] ?? "arecanut";
  const days = [7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 30;
  const today = new Date(todayISO() + "T00:00:00Z");
  const since = new Date(today.getTime() - days * 86400000);
  const crops = await prisma.crop.findMany({ where: { key: { in: MARKET_CROPS } } });
  const cropName = crops.find((c) => c.key === cropKey)?.name ?? cropKey;

  const all = await prisma.marketPrice.findMany({
    where: { cropKey, priceDate: { gte: since }, ...(sp.district ? { district: sp.district } : {}), ...(sp.q ? { market: { contains: sp.q, mode: "insensitive" } } : {}) },
    orderBy: { priceDate: "desc" },
  });
  // Prefer live data when available; never mix live and sample rows in one view.
  const hasLive = all.some((r) => r.dataKind !== "SAMPLE");
  const rows = hasLive ? all.filter((r) => r.dataKind !== "SAMPLE") : all;
  const varieties = [...new Set(rows.map((r) => r.variety))];
  const variety = sp.variety && varieties.includes(sp.variety) ? sp.variety : varieties[0];
  const vrows = rows.filter((r) => r.variety === variety);
  const latestByMarket = new Map<string, (typeof vrows)[number]>();
  for (const r of vrows) if (!latestByMarket.has(r.market)) latestByMarket.set(r.market, r);
  const latest = [...latestByMarket.values()].sort((a, b) => (favMarkets.includes(b.market) ? 1 : 0) - (favMarkets.includes(a.market) ? 1 : 0) || Number(b.modalPrice) - Number(a.modalPrice));
  const districts = [...new Set((await prisma.marketPrice.findMany({ where: { cropKey }, distinct: ["district"], select: { district: true } })).map((d) => d.district))].sort();

  const compare = (sp.compare?.split(",").filter((m) => latestByMarket.has(m)) ?? []).slice(0, 4);
  const series = compare.length ? compare : latest.slice(0, 3).map((r) => r.market);
  const dates = [...new Set(vrows.map((r) => isoDay(r.priceDate)))].sort();
  const chart = dates.map((d) => {
    const point: Record<string, string | number | null> = { date: d };
    for (const mk of series) {
      const r = vrows.find((x) => x.market === mk && isoDay(x.priceDate) === d);
      point[mk] = r ? Number(r.modalPrice) : null;
    }
    return point;
  });
  const sample = !hasLive && rows.length > 0;
  const lastRetrieved = rows.reduce<Date | null>((a, r) => (!a || r.retrievedAt > a ? r.retrievedAt : a), null);
  const alerts = await prisma.priceAlert.findMany({ where: { userId: ctx.user.id, active: true } });
  const qs = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    return `?${n.toString()}`;
  };
  // trend: first vs last modal across selected series
  const first = vrows[vrows.length - 1];
  const last = vrows[0];

  return (
    <>
      <PageHeader title="Market prices" subtitle="Mandi prices for coastal Karnataka crops. Every price shows its source and date." actions={status.live ? <RefreshPrices /> : undefined} />
      {!status.live ? (
        <Notice tone="warn" className="mb-4" title="Showing SAMPLE prices — not real market data">
          Live prices need a free data.gov.in API key (AGMARKNET dataset). Until an administrator sets <code>DATA_GOV_IN_API_KEY</code>, KRSHI shows an illustrative sample dataset so the features can be tried. Do not use these numbers to decide where or when to sell.
        </Notice>
      ) : refresh.error ? (
        <Notice tone="warn" className="mb-4">Could not reach the price provider ({refresh.error}). Showing the last stored prices — check the dates.</Notice>
      ) : !hasLive ? (
        <Notice className="mb-4">The live provider has not reported {cropName} prices for these markets in the last {days} days, so sample data is shown instead (clearly marked).</Notice>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {crops.sort((a, b) => MARKET_CROPS.indexOf(a.key) - MARKET_CROPS.indexOf(b.key)).map((c) => (
          <span key={c.key} className={cn("inline-flex items-center rounded-full border pl-3 pr-1 text-sm", c.key === cropKey ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white")}>
            <Link href={qs({ crop: c.key, variety: undefined, compare: undefined })} className="py-1">{c.name}</Link>
            <FavoriteToggle kind="CROP" value={c.key} on={favCrops.includes(c.key)} label={c.name} />
          </span>
        ))}
      </div>
      <UrlFilters filters={[
        { name: "q", type: "search", placeholder: "Search market" },
        { name: "district", type: "select", label: "District", options: districts.map((d) => ({ value: d, label: d })) },
        ...(varieties.length > 1 ? [{ name: "variety", type: "select" as const, label: "Variety", options: varieties.map((v) => ({ value: v, label: v || "Unspecified" })) }] : []),
        { name: "range", type: "select", label: "Period", options: [{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }] },
      ]} />

      {latest.length === 0 ? (
        <Card><EmptyState title={`No ${cropName} prices in this period`} body="Try a longer period or another district." /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader title={`${cropName}${variety ? ` · ${variety}` : ""} — latest by market`} subtitle={`${latest[0].unit.replace("Rs/", "₹ per ")} · tap ☆ to pin a market`} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wide text-muted"><th className="px-4 py-2">Market</th><th className="px-2 text-right">Min</th><th className="px-2 text-right">Max</th><th className="px-2 text-right">Modal</th><th className="px-2">Date</th><th className="px-2">Compare</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {latest.map((r) => {
                      const stale = (today.getTime() - r.priceDate.getTime()) / 86400000 > 3;
                      const inCompare = series.includes(r.market);
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1"><FavoriteToggle kind="MARKET" value={r.market} on={favMarkets.includes(r.market)} /><span className="font-medium">{r.market}</span></span><span className="ml-6 block text-xs text-muted">{r.district}</span></td>
                          <td className="px-2 text-right tabular text-muted">{money(Number(r.minPrice), true)}</td>
                          <td className="px-2 text-right tabular text-muted">{money(Number(r.maxPrice), true)}</td>
                          <td className="px-2 text-right font-semibold tabular">{money(Number(r.modalPrice), true)}</td>
                          <td className="px-2 text-xs">{date(r.priceDate, { day: "numeric", month: "short" })}{stale && <Badge tone="amber" className="ml-1">{Math.round((today.getTime() - r.priceDate.getTime()) / 86400000)}d old</Badge>}</td>
                          <td className="px-2">
                            <Link href={qs({ compare: (inCompare ? series.filter((s) => s !== r.market) : [...series, r.market].slice(-4)).join(",") || undefined })} className={cn("rounded-md border px-2 py-0.5 text-xs", inCompare ? "border-leaf-700 bg-leaf-50 text-leaf-800" : "border-line")} scroll={false}>{inCompare ? "In chart" : "Add"}</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-2.5">
                <Provenance kind={sample ? "SAMPLE" : "LIVE"} source={sample ? SAMPLE_SOURCE : status.name} sourceUrl={sample ? undefined : status.sourceUrl} at={lastRetrieved ? `retrieved ${dateTime(lastRetrieved)}` : null} />
              </div>
            </Card>

            <Card>
              <CardHeader title={`Modal price trend — last ${days} days`} subtitle={series.length > 1 ? "Up to 4 markets. Gaps are days a market did not report." : undefined} />
              <CardBody>
                <PriceTrendChart data={chart} series={series} unit={latest[0].unit} />
                {first && last && vrows.length > 1 && (
                  <p className="mt-2 text-xs text-muted">Across all markets: {money(Number(first.modalPrice), true)} ({date(first.priceDate, { day: "numeric", month: "short" })}, {first.market}) → {money(Number(last.modalPrice), true)} ({date(last.priceDate, { day: "numeric", month: "short" })}, {last.market}).</p>
                )}
                {sample && <p className="mt-2 text-xs font-medium text-clay-700">Sample data — trends shown are illustrative only.</p>}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Compare markets after transport" />
              <CardBody><NetComparison unit={latest[0].unit} rows={latest.map((r) => ({ market: r.market, district: r.district, modal: Number(r.modalPrice), date: isoDay(r.priceDate), sample: r.dataKind === "SAMPLE" }))} /></CardBody>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Price alerts" subtitle="Checked against reported modal prices" />
              <CardBody><PriceAlerts alerts={alerts.map((a) => ({ id: a.id, cropKey: a.cropKey, market: a.market, direction: a.direction, threshold: Number(a.threshold) }))} crops={crops.map((c) => ({ key: c.key, name: c.name }))} markets={latest.map((l) => l.market)} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="About this data" />
              <CardBody className="space-y-2 text-sm text-muted">
                <p><b className="text-ink">Source:</b> {status.live ? <a href={status.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{status.name}</a> : "Sample dataset (no live provider configured)"}.</p>
                <p>AGMARKNET prices are reported by market committees (APMCs), usually in ₹ per quintal (100 kg). Not every market reports every day, and some crops such as arecanut are also traded through cooperatives and private traders whose prices are not included.</p>
                <p>Live prices are refreshed at most every 6 hours and stored, so trends build up over time.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
