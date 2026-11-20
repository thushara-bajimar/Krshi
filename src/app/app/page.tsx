import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarDays, ChevronRight, Package, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { loadFinance, pendingWages } from "@/server/finance";
import { generateNotifications } from "@/server/notifications";
import { getWeather, resolveLocation } from "@/integrations/weather/service";
import { describeWeather } from "@/integrations/weather/codes";
import { forecastAlerts } from "@/integrations/weather/advisory";
import { getT } from "@/lib/i18n/server";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Badge, EmptyState, Provenance } from "@/components/ui/misc";
import { QuickActions } from "@/components/app/quick-actions";
import { NoFarm } from "@/components/app/no-farm";
import { ActivityRow } from "@/components/app/activity-item";
import { WeatherIcon } from "@/components/app/weather-widgets";
import { convertArea, round, type AreaUnit } from "@/lib/units";
import { daysUntil, isLowStock } from "@/lib/calc/inventory";
import { AREA_UNIT_LABEL, EXPENSE_LABEL, TASK_LABEL } from "@/lib/constants";
import { date, dateTime, money, relativeDays, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const ctx = await pageContext();
  const { t, lang } = await getT();
  void generateNotifications(ctx.user.id).catch((e) => console.warn("[notifications]", e));
  if (!ctx.farm) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-semibold">{t("dash.welcome")}, {ctx.user.name.split(" ")[0]}</h1>
        <p className="mb-6 text-sm text-muted">Let's set up your farm.</p>
        <NoFarm />
      </>
    );
  }
  const farm = ctx.farm;
  const finance = ctx.can("finance:read");
  const today = new Date(todayISO() + "T00:00:00Z");
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const loc = resolveLocation(farm);
  const [plots, tasks, activities, inventory, recentExpenses, fin, wages, weather, favCrops, trackers] = await Promise.all([
    prisma.plot.findMany({ where: { farmId: farm.id, status: { not: "ARCHIVED" } }, include: { crop: true } }),
    prisma.task.findMany({ where: { farmId: farm.id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] }, date: { lte: new Date(today.getTime() + 14 * 86400000) } }, include: { plot: true }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 6 }),
    prisma.activity.findMany({ where: { farmId: farm.id, deletedAt: null }, include: { plot: { select: { name: true } }, crop: { select: { name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5 }),
    prisma.inventoryItem.findMany({ where: { farmId: farm.id, deletedAt: null } }),
    finance ? prisma.expense.findMany({ where: { farmId: farm.id, deletedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 4 }) : [],
    finance ? loadFinance({ farmIds: [farm.id], from: monthStart, to: today }) : null,
    finance ? pendingWages(farm.id) : null,
    getWeather(loc.lat, loc.lon, loc.label),
    prisma.marketFavorite.findMany({ where: { userId: ctx.user.id, kind: "CROP" } }),
    prisma.schemeTracker.findMany({ where: { userId: ctx.user.id, status: { notIn: ["APPROVED", "REJECTED", "NOT_ELIGIBLE"] } }, include: { scheme: true }, orderBy: { followUpDate: "asc" }, take: 3 }),
  ]);

  const unit = farm.areaUnit as AreaUnit;
  const totalArea = round(plots.reduce((a, p) => a + convertArea(Number(p.area), p.areaUnit as AreaUnit, unit), 0), 2);
  const crops = [...new Set(plots.map((p) => p.crop?.name).filter(Boolean))] as string[];
  const alerts = inventory.flatMap((i) => {
    const out: { id: string; text: string; tone: "amber" | "red" }[] = [];
    if (isLowStock(Number(i.quantity), i.lowStockThreshold == null ? null : Number(i.lowStockThreshold))) out.push({ id: i.id, text: `${i.name}: only ${Number(i.quantity)} ${i.unit} left`, tone: "amber" });
    const de = daysUntil(i.expiryDate);
    if (de != null && de <= 30 && Number(i.quantity) > 0) out.push({ id: i.id, text: de < 0 ? `${i.name} has expired` : `${i.name} expires in ${de} days`, tone: de < 0 ? "red" : "amber" });
    return out;
  });

  // market summary: latest modal price for favourite crops (or the farm's crops)
  const cropKeys = favCrops.length ? favCrops.map((f) => f.value) : [...new Set(plots.map((p) => p.crop?.key).filter(Boolean))] as string[];
  const latestPrices = await Promise.all(
    cropKeys.slice(0, 3).map(async (k) => {
      const p = await prisma.marketPrice.findFirst({ where: { cropKey: k, district: farm.district }, orderBy: [{ priceDate: "desc" }, { modalPrice: "desc" }] })
        ?? (await prisma.marketPrice.findFirst({ where: { cropKey: k }, orderBy: [{ priceDate: "desc" }] }));
      return p ? { key: k, p } : null;
    }),
  );
  const wxAlerts = weather ? forecastAlerts(weather.daily) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("dash.welcome")}, {ctx.user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">{farm.name} · {date(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      <QuickActions />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("dash.totalArea")} value={`${totalArea} ${AREA_UNIT_LABEL[unit]}${totalArea === 1 ? "" : "s"}`} sub={`${plots.length} ${t("dash.plots").toLowerCase()}`} href="/app/farms" />
        <Stat label={t("dash.crops")} value={crops.length || "—"} sub={crops.join(", ") || "No crops assigned"} href="/app/farms" />
        {finance && fin ? (
          <>
            <Stat label={`${t("dash.spent")} · ${t("dash.thisMonth")}`} value={money(fin.summary.totalExpense, true)} sub={`${t("dash.income")} ${money(fin.summary.totalIncome, true)}`} href="/app/finance" />
            <Stat label={t("dash.labourPending")} value={money(wages!.total, true)} tone={wages!.total > 0 ? "warn" : "default"} sub={`${wages!.records.length} record${wages!.records.length === 1 ? "" : "s"}`} href="/app/labor" />
          </>
        ) : (
          <>
            <Stat label={t("dash.upcoming")} value={tasks.length} href="/app/calendar" />
            <Stat label={t("dash.inventoryAlerts")} value={alerts.length} tone={alerts.length ? "warn" : "default"} href="/app/inventory" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("dash.upcoming")} icon={<CalendarDays className="h-5 w-5" />} href="/app/calendar" />
            {tasks.length === 0 ? (
              <EmptyState title="No tasks in the next two weeks" body="Plan spraying, manuring, harvests and maintenance so nothing is missed." />
            ) : (
              <ul className="divide-y divide-line">
                {tasks.map((task) => {
                  const overdue = task.date < today;
                  const wxDay = weather?.daily.find((d) => d.date === task.date.toISOString().slice(0, 10));
                  const wet = wxDay && (wxDay.precipitationMm >= 2.5 || (wxDay.precipitationProbability ?? 0) >= 60);
                  return (
                    <li key={task.id}>
                      <Link href="/app/calendar" className="flex items-center gap-3 px-4 py-3 hover:bg-sand/60 sm:px-5">
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-[11px] uppercase text-muted">{date(task.date, { month: "short" })}</p>
                          <p className="text-lg font-semibold leading-none">{date(task.date, { day: "numeric" })}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="truncate text-xs text-muted">{[TASK_LABEL[task.category], task.plot?.name, task.time].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge tone={overdue ? "red" : task.status === "IN_PROGRESS" ? "blue" : "neutral"}>{overdue ? "Overdue" : relativeDays(task.date)}</Badge>
                          {wet && ["spraying", "fertilizer"].includes(task.category) && <span className="text-[11px] text-amber-800">Rain forecast</span>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("dash.recent")} href="/app/diary" />
            {activities.length === 0 ? (
              <EmptyState title={t("common.noData")} body="Your activity diary will show here." />
            ) : (
              <div className="divide-y divide-line">{activities.map((a) => <ActivityRow key={a.id} a={a} lang={lang} showMoney={finance} />)}</div>
            )}
          </Card>

          {finance && fin && (
            <Card>
              <CardHeader title={t("dash.expenses")} icon={<Wallet className="h-5 w-5" />} href="/app/finance/expenses" subtitle={t("finance.recordedNote")} />
              <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
                <div className="p-3"><p className="text-[11px] uppercase tracking-wide text-muted">{t("dash.spent")}</p><p className="font-semibold tabular">{money(fin.summary.totalExpense, true)}</p></div>
                <div className="p-3"><p className="text-[11px] uppercase tracking-wide text-muted">{t("dash.income")}</p><p className="font-semibold tabular text-leaf-700">{money(fin.summary.totalIncome, true)}</p></div>
                <div className="p-3"><p className="text-[11px] uppercase tracking-wide text-muted">{t("dash.net")}</p><p className={`font-semibold tabular ${fin.summary.net < 0 ? "text-clay-600" : "text-leaf-700"}`}>{money(fin.summary.net, true)}</p></div>
              </div>
              {recentExpenses.length === 0 ? (
                <EmptyState title="No expenses recorded yet" />
              ) : (
                <ul className="divide-y divide-line">
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.description || EXPENSE_LABEL[e.category]}</p>
                        <p className="text-xs text-muted">{EXPENSE_LABEL[e.category]} · {date(e.date)}</p>
                      </div>
                      <span className="tabular font-medium">{money(Number(e.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("dash.weather")} href="/app/weather" subtitle={loc.label} />
            <CardBody>
              {!weather ? (
                <p className="text-sm text-muted">Weather is unavailable right now (no connection to the provider and nothing cached).</p>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <WeatherIcon code={weather.current.weatherCode} className="h-10 w-10 text-leaf-700" />
                    <div>
                      <p className="text-3xl font-semibold tabular">{Math.round(weather.current.temperature)}°C</p>
                      <p className="text-sm text-muted">{describeWeather(weather.current.weatherCode, lang)} · {weather.current.humidity}% humidity</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-1 text-center">
                    {weather.daily.slice(0, 4).map((d) => (
                      <div key={d.date} className="rounded-lg bg-sand/60 px-1 py-2">
                        <p className="text-[11px] text-muted">{d.date === todayISO() ? t("common.today") : date(d.date, { weekday: "short" })}</p>
                        <WeatherIcon code={d.weatherCode} className="mx-auto my-1 h-5 w-5 text-ink/70" />
                        <p className="text-xs font-medium tabular">{Math.round(d.tempMax)}°</p>
                        <p className="text-[11px] tabular text-sky-800">{d.precipitationProbability ?? "–"}%</p>
                      </div>
                    ))}
                  </div>
                  {wxAlerts.slice(0, 2).map((a) => (
                    <p key={a.date + a.title} className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-950"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{a.title} · {date(a.date, { day: "numeric", month: "short" })}</p>
                  ))}
                  <Provenance className="mt-3" kind={weather.stale ? "CACHED" : "LIVE"} source={weather.provider} sourceUrl={weather.providerUrl} at={`fetched ${dateTime(weather.fetchedAt)}`} />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("dash.market")} href="/app/market" />
            {latestPrices.filter(Boolean).length === 0 ? (
              <EmptyState title="No prices available" body="Choose favourite crops on the market page." />
            ) : (
              <ul className="divide-y divide-line">
                {latestPrices.filter(Boolean).map((x) => (
                  <li key={x!.key} className="px-4 py-3 sm:px-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium capitalize">{x!.p.commodity}{x!.p.variety ? ` · ${x!.p.variety}` : ""}</p>
                      <p className="tabular font-semibold">₹{Number(x!.p.modalPrice).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted">{x!.p.market} · {date(x!.p.priceDate, { day: "numeric", month: "short" })} · per quintal</p>
                      {x!.p.dataKind === "SAMPLE" && <Badge tone="red">Sample</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("dash.inventoryAlerts")} icon={<Package className="h-5 w-5" />} href="/app/inventory" />
            {alerts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{inventory.length ? "Stock levels look fine." : "No inventory recorded."}</p>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.map((a, i) => (
                  <li key={i}><Link href={`/app/inventory/${a.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sand/60 sm:px-5"><span>{a.text}</span><Badge tone={a.tone}>{a.tone === "red" ? "Expired" : "Check"}</Badge></Link></li>
                ))}
              </ul>
            )}
          </Card>

          {trackers.length > 0 && (
            <Card>
              <CardHeader title="Your scheme applications" href="/app/schemes?tab=mine" />
              <ul className="divide-y divide-line">
                {trackers.map((tr) => (
                  <li key={tr.id}>
                    <Link href={`/app/schemes/${tr.scheme.slug}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-sand/60 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tr.scheme.name}</span>
                        <span className="text-xs text-muted">{tr.status.replace(/_/g, " ").toLowerCase()}{tr.followUpDate ? ` · follow up ${date(tr.followUpDate, { day: "numeric", month: "short" })}` : ""}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
