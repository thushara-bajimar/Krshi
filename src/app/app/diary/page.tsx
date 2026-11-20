import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { getT } from "@/lib/i18n/server";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { ActivityRow } from "@/components/app/activity-item";
import { UrlFilters } from "@/components/app/url-filters";
import { AddActivityButton } from "@/features/diary/actions";
import { PendingQueueList } from "@/offline/pending-list";
import { ACTIVITY_LABEL } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";

export const metadata: Metadata = { title: "Activity diary" };
const PAGE = 40;

export default async function DiaryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const sp = await searchParams;
  const { lang } = await getT();
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: Prisma.ActivityWhereInput = {
    farmId: ctx.farm.id,
    deletedAt: null,
    ...(sp.type ? { type: sp.type as never } : {}),
    ...(sp.plot ? { plotId: sp.plot } : {}),
    ...(sp.crop ? { cropId: sp.crop } : {}),
    ...(sp.from || sp.to ? { date: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to) } : {}) } } : {}),
    ...(sp.q ? { OR: ["productName", "description", "notes", "laborDetails", "productCategory"].map((f) => ({ [f]: { contains: sp.q, mode: "insensitive" } })) } : {}),
  };
  const [rows, total, costAgg, plots, crops] = await Promise.all([
    prisma.activity.findMany({ where, include: { plot: { select: { name: true } }, crop: { select: { name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: PAGE * page }),
    prisma.activity.count({ where }),
    prisma.activity.aggregate({ where, _sum: { cost: true } }),
    prisma.plot.findMany({ where: { farmId: ctx.farm.id }, orderBy: { name: "asc" } }),
    prisma.crop.findMany({ where: { OR: [{ plots: { some: { farmId: ctx.farm.id } } }, { activities: { some: { farmId: ctx.farm.id } } }] }, orderBy: { name: "asc" } }),
  ]);
  const fin = ctx.can("finance:read");
  // group by month for readability
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = date(r.date, { month: "long", year: "numeric" });
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  next.set("page", String(page + 1));

  return (
    <>
      <PageHeader title="Activity diary" subtitle="Everything done on the farm, by plot and date." actions={ctx.can("write") ? <AddActivityButton /> : undefined} />
      <PendingQueueList entity="activity" />
      <UrlFilters
        filters={[
          { name: "q", type: "search", placeholder: "Search product, notes, who did it…" },
          { name: "type", type: "select", label: "Type", options: Object.entries(ACTIVITY_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "plot", type: "select", label: "Plot", options: plots.map((p) => ({ value: p.id, label: p.name })) },
          { name: "crop", type: "select", label: "Crop", options: crops.map((c) => ({ value: c.id, label: c.name })) },
          { name: "from", type: "date", label: "From" },
          { name: "to", type: "date", label: "To" },
        ]}
      />
      <p className="mb-3 text-sm text-muted">{total} {total === 1 ? "entry" : "entries"}{fin && costAgg._sum.cost ? ` · recorded cost ${money(sumMoney([Number(costAgg._sum.cost)]))}` : ""}</p>
      {rows.length === 0 ? (
        <Card><EmptyState title={Object.keys(sp).length ? "No entries match these filters" : "Your diary is empty"} body="Record fertilizer, sprays, irrigation, pruning, harvests and more. Each entry can deduct stock and add a linked expense." action={ctx.can("write") ? <AddActivityButton /> : undefined} /></Card>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{month}</h2>
              <Card className="divide-y divide-line overflow-hidden">{items.map((a) => <ActivityRow key={a.id} a={a} lang={lang} showMoney={fin} />)}</Card>
            </section>
          ))}
          {rows.length < total && <div className="text-center"><Link href={`/app/diary?${next}`} scroll={false} className="text-sm font-medium text-leaf-700 hover:underline">Show more ({total - rows.length} older)</Link></div>}
        </div>
      )}
    </>
  );
}
