import type { Metadata } from "next";
import { AlertTriangle, Droplets, ExternalLink, Wind } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { getWeather, resolveLocation, weatherProviderInfo, OFFICIAL_ADVISORY_LINKS } from "@/integrations/weather/service";
import { forecastAlerts, rainCategory, taskWeatherContext } from "@/integrations/weather/advisory";
import { describeWeather } from "@/integrations/weather/codes";
import { getT } from "@/lib/i18n/server";
import { PageHeader, Badge, Notice, Provenance } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { WeatherIcon } from "@/components/app/weather-widgets";
import { TASK_LABEL } from "@/lib/constants";
import { date, dateTime, isoDay, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Weather" };

export default async function WeatherPage() {
  const ctx = await pageContext();
  const { lang } = await getT();
  const loc = resolveLocation(ctx.farm, ctx.user.district);
  const w = await getWeather(loc.lat, loc.lon, loc.label);
  const today = new Date(todayISO() + "T00:00:00Z");
  const tasks = ctx.farm
    ? await prisma.task.findMany({ where: { farmId: ctx.farm.id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] }, date: { gte: today, lte: new Date(today.getTime() + 7 * 86400000) } }, include: { plot: true }, orderBy: { date: "asc" } })
    : [];
  const alerts = w ? forecastAlerts(w.daily) : [];
  const weekRain = w ? w.daily.reduce((a, d) => a + d.precipitationMm, 0) : 0;

  return (
    <>
      <PageHeader title="Weather" subtitle={`${loc.label}${ctx.farm ? ` · ${ctx.farm.name}` : ""}`} />
      {!loc.precise && <Notice className="mb-4">Using the district centre because this farm has no map location. Mark the farm on the map (Farms → Edit) for a forecast at your farm.</Notice>}
      {!w ? (
        <Notice tone="warn" title="Weather unavailable">Could not reach the weather provider and there is no saved forecast for this location. Check your connection, or see the official IMD links below.</Notice>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {w.stale && <Notice tone="warn">Showing the forecast saved at {dateTime(w.fetchedAt)}. A newer one is being fetched in the background — reload in a moment. If it stays the same, the provider cannot be reached right now.</Notice>}
            <Card>
              <CardBody className="flex flex-wrap items-center gap-6">
                <WeatherIcon code={w.current.weatherCode} className="h-14 w-14 text-leaf-700" />
                <div>
                  <p className="text-4xl font-semibold tabular">{Math.round(w.current.temperature)}°C</p>
                  <p className="text-muted">{describeWeather(w.current.weatherCode, lang)}</p>
                </div>
                <dl className="ml-auto grid grid-cols-3 gap-6 text-sm">
                  <div><dt className="text-xs text-muted">Humidity</dt><dd className="font-medium tabular">{w.current.humidity}%</dd></div>
                  <div><dt className="text-xs text-muted">Wind</dt><dd className="font-medium tabular">{Math.round(w.current.windKmh)} km/h</dd></div>
                  <div><dt className="text-xs text-muted">Rain now</dt><dd className="font-medium tabular">{w.current.precipitationMm} mm</dd></div>
                </dl>
              </CardBody>
              <div className="border-t border-line px-5 py-2.5">
                <Provenance kind={w.stale ? "CACHED" : "LIVE"} source={w.provider} sourceUrl={w.providerUrl} at={`observation ${w.current.time.replace("T", " ")} IST · fetched ${dateTime(w.fetchedAt)}`} />
              </div>
            </Card>

            {alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <Notice key={a.date + a.title} tone="warn" title={`${a.title} — ${date(a.date, { weekday: "short", day: "numeric", month: "short" })}`}>{a.detail}</Notice>
                ))}
              </div>
            )}

            <Card className="overflow-hidden">
              <CardHeader title="7-day forecast" subtitle={`Total rain forecast this week: ${weekRain.toFixed(1)} mm`} />
              <ul className="divide-y divide-line">
                {w.daily.map((d) => {
                  const cat = rainCategory(d.precipitationMm);
                  return (
                    <li key={d.date} className="grid grid-cols-[88px_32px_1fr_auto] items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="text-sm font-medium">{d.date === todayISO() ? "Today" : date(d.date, { weekday: "short", day: "numeric" })}</span>
                      <WeatherIcon code={d.weatherCode} className="h-6 w-6 text-ink/70" />
                      <span className="min-w-0 text-sm">
                        <span className="block truncate">{describeWeather(d.weatherCode, lang)}</span>
                        <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                          <span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3" />{d.precipitationMm.toFixed(1)} mm{d.precipitationProbability != null ? ` · ${d.precipitationProbability}%` : ""}</span>
                          <span className="inline-flex items-center gap-1"><Wind className="h-3 w-3" />{Math.round(d.windMaxKmh)} km/h</span>
                          {["heavy", "very_heavy", "extremely_heavy"].includes(cat) && <Badge tone="amber">{cat.replace("_", " ")}</Badge>}
                        </span>
                      </span>
                      <span className="text-right text-sm tabular"><b>{Math.round(d.tempMax)}°</b> <span className="text-muted">{Math.round(d.tempMin)}°</span></span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Your planned work this week" subtitle="Forecast context only — not advice on what to apply" />
              {tasks.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No tasks planned in the next 7 days.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {tasks.map((t) => {
                    const c = taskWeatherContext(isoDay(t.date), w.daily);
                    return (
                      <li key={t.id} className="px-4 py-3 text-sm sm:px-5">
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-muted">{TASK_LABEL[t.category]} · {date(t.date, { weekday: "short", day: "numeric", month: "short" })}{t.plot ? ` · ${t.plot.name}` : ""}</p>
                        <p className={`mt-1 flex items-start gap-1.5 text-xs ${c.risk === "rain" ? "text-amber-900" : "text-muted"}`}>{c.risk === "rain" && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{c.note}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Official advisories" subtitle="For Dakshina Kannada, Udupi and coastal Karnataka" />
              <ul className="divide-y divide-line">
                {OFFICIAL_ADVISORY_LINKS.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2 px-4 py-3 text-sm hover:bg-sand/60 sm:px-5">
                      <span><span className="font-medium">{l.name}</span><span className="block text-xs text-muted">{l.note}</span></span>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-4 py-2.5 text-xs text-muted">IMD Agromet district advisories are not available through an open API, so KRSHI links to them instead of copying them. Always follow official warnings.</p>
            </Card>
            <p className="px-1 text-xs text-muted">Forecast data: <a href={weatherProviderInfo.url} className="underline" target="_blank" rel="noopener noreferrer">{weatherProviderInfo.name}</a> (model-based forecast, refreshed every 30 minutes; <a href={weatherProviderInfo.terms} className="underline" target="_blank" rel="noopener noreferrer">terms</a>). Rain categories follow IMD terminology.</p>
          </div>
        </div>
      )}
    </>
  );
}
