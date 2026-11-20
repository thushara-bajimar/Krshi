import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { AddFarmButton } from "@/features/farms/farm-actions";
import { MapView } from "@/components/map";
import { AREA_UNIT_LABEL, ROLE_LABEL } from "@/lib/constants";
import { convertArea, round, type AreaUnit } from "@/lib/units";
import { number } from "@/lib/format";

export const metadata: Metadata = { title: "Farms & plots" };

export default async function FarmsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await pageContext();
  const { welcome } = await searchParams;
  const farms = await prisma.farm.findMany({
    where: { memberships: { some: { userId: ctx.user.id } } },
    include: { plots: { include: { crop: true }, where: { status: { not: "ARCHIVED" } } }, memberships: { where: { userId: ctx.user.id } } },
    orderBy: { createdAt: "asc" },
  });
  const points = farms.filter((f) => f.latitude != null && f.longitude != null).map((f) => ({ lat: Number(f.latitude), lng: Number(f.longitude), label: f.name }));

  return (
    <>
      <PageHeader title="Farms & plots" subtitle="Your farms and the plots inside them. Tap a farm to see its plots, map and who has access." actions={<AddFarmButton welcome={welcome === "1" && farms.length === 0} />} />
      {farms.length === 0 ? (
        <Card><EmptyState title="No farms yet" body="Add your first farm — it takes a minute. You can add plots, crops and a map location next." action={<AddFarmButton />} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            {farms.map((f) => {
              const unit = f.areaUnit as AreaUnit;
              const area = round(f.plots.reduce((a, p) => a + convertArea(Number(p.area), p.areaUnit as AreaUnit, unit), 0), 2);
              const crops = [...new Set(f.plots.map((p) => p.crop?.name).filter(Boolean))];
              return (
                <Link key={f.id} href={`/app/farms/${f.id}`} className="card flex items-center gap-4 p-4 transition-colors hover:border-leaf-300">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700"><MapPin className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{f.name}</p>
                      {f.id === ctx.farm?.id && <Badge tone="green">Active</Badge>}
                      {f.memberships[0]?.role !== "OWNER" && <Badge>{ROLE_LABEL[f.memberships[0]?.role]}</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted">{[f.village, f.taluk, f.district].filter(Boolean).join(", ")}</p>
                    <p className="mt-1 text-xs text-muted">{f.plots.length} plot{f.plots.length === 1 ? "" : "s"} · {number(area)} {AREA_UNIT_LABEL[unit]}s in plots{f.totalArea ? ` (of ${number(Number(f.totalArea))})` : ""}{crops.length ? ` · ${crops.join(", ")}` : ""}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                </Link>
              );
            })}
          </div>
          <div>
            {points.length > 0 ? (
              <MapView points={points} height={320} zoom={11} />
            ) : (
              <div className="card p-4 text-sm text-muted">Mark your farm on the map (Edit farm) to see it here and get farm-level weather.</div>
            )}
            <p className="mt-2 text-xs text-muted">Only you and people you share a farm with can see its location.</p>
          </div>
        </div>
      )}
    </>
  );
}
