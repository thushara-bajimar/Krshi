import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { getWeather, resolveLocation } from "@/integrations/weather/service";
import { taskWeatherContext } from "@/integrations/weather/advisory";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { TaskItem, type TaskRec } from "@/features/calendar/task-item";
import { AddTaskButton, PlanFromHistory } from "@/features/calendar/plan-actions";
import { ACTIVITY_LABEL } from "@/lib/constants";
import { date, isoDay, todayISO } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Calendar & tasks" };
const ACT_TO_TASK: Record<string, string> = { FERTILIZER: "fertilizer", PESTICIDE: "spraying", FUNGICIDE: "spraying", HERBICIDE: "spraying", IRRIGATION: "irrigation", PRUNING: "pruning", CLEANING: "cleaning", HARVESTING: "harvesting", PLANTING: "planting" };
const OPEN = ["PLANNED", "IN_PROGRESS"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string; day?: string }> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "month";
  const todayS = todayISO();
  const today = new Date(todayS + "T00:00:00Z");
  const monthParam = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : todayS.slice(0, 7);
  const [y, m] = monthParam.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0));

  // week view: the Monday–Sunday week containing ?day (or today)
  const anchor = sp.day ? new Date(sp.day + "T00:00:00Z") : today;
  const weekStart = new Date(anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  const rangeFrom = view === "week" ? weekStart : new Date(monthStart.getTime() - 7 * 86400000);
  const rangeTo = view === "week" ? weekEnd : new Date(monthEnd.getTime() + 14 * 86400000);

  const farm = ctx.farm;
  const loc = resolveLocation(farm);
  const taskInclude = { plot: true, workers: { include: { worker: true } } } as const;
  const [tasks, activities, upcoming, lastYear, weather] = await Promise.all([
    prisma.task.findMany({ where: { farmId: farm.id, deletedAt: null, date: { gte: rangeFrom, lte: rangeTo } }, include: taskInclude, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    prisma.activity.findMany({ where: { farmId: farm.id, deletedAt: null, date: { gte: rangeFrom, lte: rangeTo } }, select: { id: true, date: true, type: true } }),
    prisma.task.findMany({ where: { farmId: farm.id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] } }, include: taskInclude, orderBy: [{ date: "asc" }, { time: "asc" }], take: 30 }),
    // The farmer's own activities from the same period last year — a basis for planning, not a prescribed schedule.
    prisma.activity.findMany({ where: { farmId: farm.id, deletedAt: null, date: { gte: new Date(today.getTime() - 365 * 86400000), lte: new Date(today.getTime() - 335 * 86400000) } }, include: { plot: true }, orderBy: { date: "asc" }, take: 12 }),
    getWeather(loc.lat, loc.lon, loc.label),
  ]);
  const wx = (t: { date: Date; category: string }) => (weather && ["spraying", "fertilizer", "harvesting"].includes(t.category) ? taskWeatherContext(isoDay(t.date), weather.daily) : null);
  const isOverdue = (t: { date: Date; status: string }) => t.date < today && OPEN.includes(t.status);
  const byDay = new Map<string, { tasks: typeof tasks; acts: number }>();
  for (const t of tasks) { const k = isoDay(t.date); const e = byDay.get(k) ?? { tasks: [], acts: 0 }; e.tasks.push(t); byDay.set(k, e); }
  for (const a of activities) { const k = isoDay(a.date); const e = byDay.get(k) ?? { tasks: [], acts: 0 }; e.acts++; byDay.set(k, e); }
  const editable = ctx.can("write");
  const row = (t: (typeof tasks)[number]) => <TaskItem key={t.id} task={serialize(t) as unknown as TaskRec} editable={editable} weather={wx(t)} overdue={isOverdue(t)} />;

  // Month grid (Monday first)
  const gridStart = new Date(monthStart.getTime() - ((monthStart.getUTCDay() + 6) % 7) * 86400000);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400000)).filter((d, i) => i < 35 || d <= monthEnd);
  const prevM = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const nextM = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const prevW = isoDay(new Date(weekStart.getTime() - 7 * 86400000));
  const nextW = isoDay(new Date(weekStart.getTime() + 7 * 86400000));
  const selected = sp.day;
  const dayTasks = selected ? tasks.filter((t) => isoDay(t.date) === selected) : [];

  return (
    <>
      <PageHeader title="Calendar & tasks" subtitle="Plan farm work, assign workers and see what is due." actions={editable ? <AddTaskButton date={selected} /> : undefined} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3 sm:px-4">
              <div className="flex items-center gap-1">
                <Link href={view === "week" ? `?view=week&day=${prevW}` : `?month=${prevM}`} className="rounded-md p-2 hover:bg-sand" aria-label="Previous"><ChevronLeft className="h-5 w-5" /></Link>
                <p className="min-w-[130px] text-center text-sm font-semibold sm:min-w-[150px] sm:text-base">{view === "week" ? `${date(weekStart, { day: "numeric", month: "short" })} – ${date(weekEnd, { day: "numeric", month: "short" })}` : date(monthStart, { month: "long", year: "numeric" })}</p>
                <Link href={view === "week" ? `?view=week&day=${nextW}` : `?month=${nextM}`} className="rounded-md p-2 hover:bg-sand" aria-label="Next"><ChevronRight className="h-5 w-5" /></Link>
              </div>
              <div className="flex rounded-lg border border-line p-0.5 text-sm">
                <Link href={`?month=${todayS.slice(0, 7)}`} className={cn("rounded-md px-3 py-1", view === "month" && "bg-leaf-800 text-white")}>Month</Link>
                <Link href={`?view=week&day=${todayS}`} className={cn("rounded-md px-3 py-1", view === "week" && "bg-leaf-800 text-white")}>Week</Link>
              </div>
            </div>
            {view === "month" ? (
              <div>
                <div className="grid grid-cols-7 border-b border-line bg-sand/40 text-center text-[11px] font-medium uppercase text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
                <div className="grid grid-cols-7">
                  {days.map((d) => {
                    const k = isoDay(d);
                    const e = byDay.get(k);
                    const inMonth = d.getUTCMonth() === m - 1;
                    return (
                      <Link key={k} href={`?month=${monthParam}&day=${k}`} scroll={false}
                        className={cn("min-h-[64px] border-b border-r border-line p-1 text-left text-xs transition-colors hover:bg-leaf-50 sm:min-h-[84px] sm:p-1.5", !inMonth && "bg-sand/30 text-muted", selected === k && "bg-leaf-50 ring-2 ring-inset ring-leaf-600")}
                        aria-label={`${date(d)}: ${e?.tasks.length ?? 0} tasks`}>
                        <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", k === todayS && "bg-leaf-800 font-semibold text-white")}>{d.getUTCDate()}</span>
                        <div className="mt-0.5 space-y-0.5">
                          {e?.tasks.slice(0, 2).map((t) => <p key={t.id} className={cn("hidden truncate rounded px-1 sm:block", t.status === "COMPLETED" ? "bg-leaf-100 text-leaf-800 line-through" : isOverdue(t) ? "bg-clay-50 text-clay-700" : "bg-earth-100 text-earth-800")}>{t.title}</p>)}
                          <div className="flex flex-wrap gap-0.5 sm:hidden">{e?.tasks.map((t) => <span key={t.id} className={cn("h-1.5 w-1.5 rounded-full", isOverdue(t) ? "bg-clay-600" : "bg-earth-500")} />)}</div>
                          {(e?.tasks.length ?? 0) > 2 && <p className="hidden text-muted sm:block">+{e!.tasks.length - 2} more</p>}
                          {e?.acts ? <p className="text-[10px] text-leaf-700">{e.acts} done</p> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)).map((d) => {
                  const k = isoDay(d);
                  const e = byDay.get(k);
                  return (
                    <li key={k}>
                      <p className={cn("bg-sand/40 px-4 py-1.5 text-xs font-medium", k === todayS && "text-leaf-800")}>{date(d, { weekday: "long", day: "numeric", month: "short" })}{k === todayS ? " · Today" : ""}{e?.acts ? ` · ${e.acts} activit${e.acts > 1 ? "ies" : "y"} recorded` : ""}</p>
                      {e?.tasks.length ? <div className="divide-y divide-line">{e.tasks.map(row)}</div> : <p className="px-4 py-2 text-xs text-muted">No tasks</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {selected && view === "month" && (
            <Card>
              <CardHeader title={date(selected, { weekday: "long", day: "numeric", month: "long" })} action={editable ? <AddTaskButton date={selected} /> : undefined} />
              {dayTasks.length ? <div className="divide-y divide-line">{dayTasks.map(row)}</div> : <EmptyState title="Nothing planned this day" />}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Open tasks" subtitle="Planned and in progress" />
            {upcoming.length === 0 ? <EmptyState title="No open tasks" /> : <div className="divide-y divide-line">{upcoming.map(row)}</div>}
            {weather && <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Rain notes use the {weather.provider} 7-day forecast for {weather.locationLabel}.</p>}
          </Card>
          <Card>
            <CardHeader title="Same time last year" icon={<History className="h-5 w-5" />} subtitle="From your own diary — use it to plan, not as a prescription" />
            {lastYear.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No diary entries from this time last year. As you keep records, KRSHI shows what you did a year ago so you can plan the season.</p>
            ) : (
              <ul className="divide-y divide-line">
                {lastYear.map((a) => {
                  const planDate = isoDay(new Date(a.date.getTime() + 365 * 86400000));
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="min-w-0"><span className="block truncate">{ACTIVITY_LABEL[a.type]}{a.productName ? ` — ${a.productName}` : ""}</span><span className="text-xs text-muted">{date(a.date)}{a.plot ? ` · ${a.plot.name}` : ""}</span></span>
                      {editable && <PlanFromHistory title={`${ACTIVITY_LABEL[a.type]}${a.productName ? ` — ${a.productName}` : ""}${a.plot ? ` (${a.plot.name})` : ""}`} category={ACT_TO_TASK[a.type] ?? "other"} plotId={a.plotId} date={planDate < todayS ? todayS : planDate} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
