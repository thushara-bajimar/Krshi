import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { EditPlotButton } from "@/features/farms/farm-actions";
import { PlotQuickAdd } from "@/features/farms/plot-quick-add";
import { ActivityIcon } from "@/components/app/activity-icon";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, AREA_UNIT_LABEL, TASK_LABEL, WORK_LABEL } from "@/lib/constants";
import { cropAge, date, money, number, relativeDays, todayISO } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";
import { yieldPerArea } from "@/lib/calc/yield";
import { cn } from "@/lib/cn";
import type { AreaUnit } from "@/lib/units";

export const metadata: Metadata = { title: "Plot" };

export default async function PlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext();
  const plot = await prisma.plot.findUnique({ where: { id }, include: { crop: true, farm: true } });
  const membership = plot && ctx.farms.find((f) => f.id === plot.farmId);
  if (!plot || !membership) notFound();
  const fin = can(membership.role, "finance:read");
  const editable = can(membership.role, "write") && ctx.farm?.id === plot.farmId;
  const today = new Date(todayISO() + "T00:00:00Z");

  const [activities, labor, tasks, harvests, expenses] = await Promise.all([
    prisma.activity.findMany({ where: { plotId: id, deletedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    fin ? prisma.laborRecord.findMany({ where: { plotId: id, deletedAt: null }, include: { worker: true }, orderBy: { date: "desc" } }) : [],
    prisma.task.findMany({ where: { plotId: id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] }, date: { gte: new Date(today.getTime() - 30 * 86400000) } }, orderBy: { date: "asc" } }),
    prisma.harvest.findMany({ where: { plotId: id, deletedAt: null }, orderBy: { date: "desc" } }),
    fin ? prisma.expense.findMany({ where: { plotId: id, deletedAt: null } }) : [],
  ]);

  type Ev = { key: string; date: Date; kind: "activity" | "labour" | "harvest"; title: string; detail: string; cost: number | null; type?: string; href?: string };
  const events: Ev[] = [
    ...activities.map((a) => ({ key: a.id, date: a.date, kind: "activity" as const, type: a.type, title: `${ACTIVITY_LABEL[a.type]}${a.productName ? ` — ${a.productName}` : ""}`, detail: [a.quantity != null && `${number(Number(a.quantity))} ${a.quantityUnit ?? ""}`, a.dilution, a.laborDetails && `By ${a.laborDetails}`, a.description].filter(Boolean).join(" · "), cost: a.cost == null ? null : Number(a.cost), href: `/app/diary/${a.id}` })),
    ...labor.map((l) => ({ key: l.id, date: l.date, kind: "labour" as const, title: `Labour — ${WORK_LABEL[l.taskCategory] ?? l.taskCategory}`, detail: `${l.worker?.name ?? l.workerLabel ?? `${l.workerCount} workers`} · ${l.paymentStatus.toLowerCase()}`, cost: Number(l.totalCost) })),
    ...harvests.map((h) => ({ key: h.id, date: h.date, kind: "harvest" as const, title: "Harvest", detail: `${number(Number(h.quantity))} ${h.unit}${h.grade ? ` · ${h.grade}` : ""}`, cost: null, href: "/app/harvests" })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const yearAgo = new Date(today.getTime() - 365 * 86400000);
  const cost12 = sumMoney([...expenses.filter((e) => e.date >= yearAgo).map((e) => Number(e.amount)), ...labor.filter((l) => l.date >= yearAgo).map((l) => Number(l.totalCost))]);
  const units = [...new Set(harvests.map((h) => h.unit))];
  const harvest12 = units.length === 1 ? harvests.filter((h) => h.date >= yearAgo).reduce((a, h) => a + Number(h.quantity), 0) : null;
  const ypa = harvest12 != null ? yieldPerArea(harvest12, Number(plot.area), plot.areaUnit as AreaUnit) : null;

  return (
    <>
      <PageHeader
        back={<Link href={`/app/farms/${plot.farmId}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />{plot.farm.name}</Link>}
        title={plot.name}
        subtitle={[plot.crop?.name, plot.variety, `${number(Number(plot.area))} ${AREA_UNIT_LABEL[plot.areaUnit]}`, cropAge(plot.plantingDate) && `${cropAge(plot.plantingDate)} old`].filter(Boolean).join(" · ")}
        actions={editable ? <><EditPlotButton plot={serialize(plot)} /><DeleteRecordButton entity="plot" id={plot.id} label="this plot" body="Records linked to this plot are kept but will no longer show a plot." redirectTo={`/app/farms/${plot.farmId}`} /></> : undefined}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Activities recorded" value={activities.length} />
        <Stat label="Planned next" value={tasks.length} sub={tasks[0] ? `${tasks[0].title} · ${relativeDays(tasks[0].date)}` : "Nothing planned"} />
        {fin && <Stat label="Cost, last 12 months" value={money(cost12, true)} sub="Expenses + labour on this plot" />}
        <Stat label="Harvest, last 12 months" value={harvest12 != null ? `${number(harvest12)} ${units[0]}` : units.length > 1 ? "Mixed units" : "—"} sub={ypa != null ? `${number(ypa)} ${units[0]} per acre` : "Record harvests to see yield"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Timeline" subtitle="What was done, when, with what, at what cost, and by whom" />
          {editable && <div className="border-b border-line px-4 py-3 sm:px-5"><PlotQuickAdd plotId={plot.id} cropId={plot.cropId} /></div>}
          {events.length === 0 ? (
            <EmptyState title="Nothing recorded for this plot yet" />
          ) : (
            <ol className="relative px-4 py-4 sm:px-5">
              <span className="absolute bottom-6 left-[34px] top-6 w-px bg-line sm:left-[38px]" aria-hidden />
              {events.map((e) => (
                <li key={e.key} className="relative flex gap-3 pb-5 last:pb-0">
                  <span className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white", e.kind === "activity" ? ACTIVITY_COLOR[e.type!] : e.kind === "labour" ? "bg-earth-100 text-earth-800" : "bg-leaf-200 text-leaf-900")}>
                    <ActivityIcon type={e.kind === "activity" ? e.type! : e.kind === "harvest" ? "HARVESTING" : "OTHER"} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      {e.href ? <Link href={e.href} className="text-sm font-medium hover:underline">{e.title}</Link> : <p className="text-sm font-medium">{e.title}</p>}
                      <p className="text-xs text-muted">{date(e.date)}</p>
                    </div>
                    {e.detail && <p className="mt-0.5 text-sm text-muted">{e.detail}</p>}
                    {fin && e.cost != null && <p className="mt-0.5 text-sm font-medium tabular">{money(e.cost)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Scheduled next" href="/app/calendar" />
            {tasks.length === 0 ? <p className="px-5 py-4 text-sm text-muted">No planned tasks.</p> : (
              <ul className="divide-y divide-line">{tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                  <span className="min-w-0"><span className="block truncate font-medium">{t.title}</span><span className="text-xs text-muted">{TASK_LABEL[t.category]} · {date(t.date)}</span></span>
                  <Badge tone={t.date < today ? "red" : "neutral"}>{relativeDays(t.date)}</Badge>
                </li>
              ))}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Plot details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {[["Crop", plot.crop?.name], ["Variety", plot.variety], ["Planted", plot.plantingDate ? date(plot.plantingDate) : null], ["Plants", plot.plantCount], ["Soil", plot.soilType], ["Irrigation", plot.irrigation], ["Status", plot.status.toLowerCase()]].map(([k, v]) => (
                  <div key={String(k)} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right">{v ?? "—"}</dd></div>
                ))}
              </dl>
              {plot.notes && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">{plot.notes}</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
