import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Sprout } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { MapView } from "@/components/map";
import { ActivityRow } from "@/components/app/activity-item";
import { AddPlotButton, DeleteFarmButton, EditFarmButton, MembersPanel } from "@/features/farms/farm-actions";
import { SwitchFarmButton } from "@/features/farms/switch-farm";
import { AREA_UNIT_LABEL } from "@/lib/constants";
import { convertArea, round, type AreaUnit } from "@/lib/units";
import { cropAge, date, money, number } from "@/lib/format";
import { loadFinance } from "@/server/finance";

export const metadata: Metadata = { title: "Farm" };

export default async function FarmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext();
  const mine = ctx.farms.find((f) => f.id === id);
  if (!mine) notFound();
  const role = mine.role;
  const isActive = ctx.farm?.id === id;
  const [farm, members, activities, tasks] = await Promise.all([
    prisma.farm.findUniqueOrThrow({ where: { id }, include: { plots: { include: { crop: true }, orderBy: { name: "asc" } } } }),
    prisma.farmMembership.findMany({ where: { farmId: id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.activity.findMany({ where: { farmId: id, deletedAt: null }, include: { plot: { select: { name: true } }, crop: { select: { name: true } } }, orderBy: { date: "desc" }, take: 5 }),
    prisma.task.count({ where: { farmId: id, deletedAt: null, status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
  ]);
  const yearStart = new Date(Date.UTC(new Date().getFullYear(), 0, 1));
  const fin = can(role, "finance:read") ? await loadFinance({ farmIds: [id], from: yearStart, to: new Date() }) : null;
  const unit = farm.areaUnit as AreaUnit;
  const live = farm.plots.filter((p) => p.status !== "ARCHIVED");
  const area = round(live.reduce((a, p) => a + convertArea(Number(p.area), p.areaUnit as AreaUnit, unit), 0), 2);
  const plotPoints = farm.plots.filter((p) => p.latitude != null).map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude), label: p.name }));
  const farmPoint = farm.latitude != null ? { lat: Number(farm.latitude), lng: Number(farm.longitude), label: farm.name } : null;

  return (
    <>
      <PageHeader
        back={<Link href="/app/farms" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All farms</Link>}
        title={farm.name}
        subtitle={[farm.village, farm.taluk, farm.district].filter(Boolean).join(", ")}
        actions={
          isActive ? (
            <>
              {can(role, "write") && <AddPlotButton />}
              {can(role, "write") && <EditFarmButton farm={serialize({ ...farm, plots: undefined })} />}
              {can(role, "manage") && <DeleteFarmButton id={farm.id} name={farm.name} />}
            </>
          ) : (
            <SwitchFarmButton farmId={farm.id} />
          )
        }
      />
      {!isActive && <Notice className="mb-5">This is not your active farm. Switch to it to add plots or records.</Notice>}
      {farm.isDemo && <Notice tone="warn" className="mb-5">Demo farm — all records here are illustrative.</Notice>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Area in plots" value={`${number(area)} ${AREA_UNIT_LABEL[unit]}s`} sub={farm.totalArea ? `Farm total ${number(Number(farm.totalArea))}` : undefined} />
        <Stat label="Plots" value={live.length} sub={[...new Set(live.map((p) => p.crop?.name).filter(Boolean))].join(", ") || "No crops"} />
        <Stat label="Open tasks" value={tasks} href={isActive ? "/app/calendar" : undefined} />
        {fin ? <Stat label="Net this year (recorded)" value={money(fin.summary.net, true)} tone={fin.summary.net < 0 ? "bad" : "good"} sub={`Spent ${money(fin.summary.totalExpense, true)}`} href={isActive ? "/app/finance" : undefined} /> : <Stat label="Recent activities" value={activities.length} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Plots" subtitle="Tap a plot to see its full timeline" />
            {farm.plots.length === 0 ? (
              <EmptyState icon={<Sprout className="h-6 w-6" />} title="No plots yet" body="Split the farm into plots (e.g. 'Areca block A', 'Paddy field') so activities, labour and costs can be tracked per plot." action={isActive && can(role, "write") ? <AddPlotButton /> : undefined} />
            ) : (
              <ul className="divide-y divide-line">
                {farm.plots.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/plots/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sand/60 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">{p.name}{p.status !== "ACTIVE" && <Badge>{p.status.toLowerCase()}</Badge>}</p>
                        <p className="truncate text-xs text-muted">{[p.crop?.name, p.variety, cropAge(p.plantingDate) && `${cropAge(p.plantingDate)} old`, p.plantCount && `${p.plantCount} plants`].filter(Boolean).join(" · ")}</p>
                      </div>
                      <p className="shrink-0 text-sm tabular text-muted">{number(Number(p.area))} {AREA_UNIT_LABEL[p.areaUnit]}</p>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent activities" href={isActive ? "/app/diary" : undefined} />
            {activities.length === 0 ? <EmptyState title="No activities yet" /> : <div className="divide-y divide-line">{activities.map((a) => <ActivityRow key={a.id} a={a} showMoney={!!fin} />)}</div>}
          </Card>
          {fin && (
            <Card>
              <CardHeader title={`Money this year (${date(yearStart, { year: "numeric" })})`} subtitle="Only recorded entries are counted" />
              <CardBody className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-muted">Spent</p><p className="font-semibold tabular">{money(fin.summary.totalExpense, true)}</p></div>
                <div><p className="text-xs text-muted">Income</p><p className="font-semibold tabular text-leaf-700">{money(fin.summary.totalIncome, true)}</p></div>
                <div><p className="text-xs text-muted">Labour</p><p className="font-semibold tabular">{money(fin.laborTotal, true)}</p></div>
              </CardBody>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Location" />
            <CardBody>
              {farmPoint || plotPoints.length ? (
                <MapView points={[...(farmPoint ? [farmPoint] : []), ...plotPoints]} height={240} />
              ) : (
                <p className="text-sm text-muted">No map location. {isActive && can(role, "write") ? "Use Edit to mark it — weather then uses your exact farm location instead of the district centre." : ""}</p>
              )}
              {farm.location && <p className="mt-2 text-sm text-muted">{farm.location}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="People with access" subtitle="Permissions are enforced on the server" />
            <CardBody><MembersPanel farmId={farm.id} members={members} canManage={can(role, "manage")} selfId={ctx.user.id} /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
