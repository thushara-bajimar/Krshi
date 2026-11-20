import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader, Badge, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { UrlFilters } from "@/components/app/url-filters";
import { RelevanceChecker } from "@/features/schemes/relevance";
import type { Rules } from "@/lib/schemes";
import { convertArea, type AreaUnit } from "@/lib/units";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Government schemes" };
const CATS: Record<string, string> = {
  financial_assistance: "Financial assistance", subsidy: "Subsidies", horticulture: "Horticulture", irrigation: "Irrigation", equipment: "Equipment",
  crop_insurance: "Crop insurance", soil_health: "Soil health", training: "Training", infrastructure: "Infrastructure", state_schemes: "State schemes",
};

export default async function SchemesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  const sp = await searchParams;
  const tab = sp.tab === "mine" ? "mine" : sp.tab === "check" ? "check" : "all";
  const where: Prisma.SchemeWhereInput = {
    ...(sp.category ? { categories: { has: sp.category } } : {}),
    ...(sp.crop ? { OR: [{ crops: { has: sp.crop } }, { crops: { isEmpty: true } }] } : {}),
    ...(sp.level ? { level: sp.level } : {}),
    ...(sp.district ? { OR: [{ districts: { has: sp.district } }, { districts: { isEmpty: true } }] } : {}),
    ...(sp.q ? { AND: [{ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }, { benefits: { contains: sp.q, mode: "insensitive" } }] }] } : {}),
  };
  const [schemes, trackers, crops, plots] = await Promise.all([
    prisma.scheme.findMany({ where, orderBy: [{ level: "asc" }, { name: "asc" }] }),
    prisma.schemeTracker.findMany({ where: { userId: ctx.user.id }, include: { scheme: true }, orderBy: { updatedAt: "desc" } }),
    prisma.crop.findMany({ where: { isSystem: true }, orderBy: { name: "asc" } }),
    ctx.farm ? prisma.plot.findMany({ where: { farm: { memberships: { some: { userId: ctx.user.id, role: "OWNER" } } } }, include: { crop: true } }) : [],
  ]);
  const tracked = new Map(trackers.map((t) => [t.schemeId, t]));
  const myCrops = [...new Set(plots.map((p) => p.crop?.key).filter(Boolean))] as string[];
  const myAcres = plots.length ? Math.round(plots.reduce((a, p) => a + convertArea(Number(p.area), p.areaUnit as AreaUnit, "ACRE"), 0) * 100) / 100 : null;
  const tabCls = (t: string) => cn("rounded-md px-3 py-1.5 text-sm", tab === t ? "bg-leaf-800 text-white" : "hover:bg-sand");

  return (
    <>
      <PageHeader title="Government schemes" subtitle="Central and Karnataka schemes for farmers, with official links and your own application tracker." />
      <Notice tone="warn" className="mb-4">Scheme rules, amounts and dates change. Summaries here are for discovery only — always confirm on the <b>official portal</b> or at your <b>Raitha Samparka Kendra</b> before applying. Beware of fake websites and agents asking for fees.</Notice>
      <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-0.5">
        <Link href="/app/schemes" className={tabCls("all")}>All schemes</Link>
        <Link href="/app/schemes?tab=check" className={tabCls("check")}>Check relevance</Link>
        <Link href="/app/schemes?tab=mine" className={tabCls("mine")}>My applications ({trackers.length})</Link>
      </div>

      {tab === "check" ? (
        <Card><CardHeader title="Which schemes might fit me?" /><CardBody><RelevanceChecker schemes={(await prisma.scheme.findMany({ orderBy: { name: "asc" } })).map((s) => ({ slug: s.slug, name: s.name, rules: s.eligibilityRules as Rules | null, crops: s.crops }))} defaultCrops={myCrops} defaultAcres={myAcres} /></CardBody></Card>
      ) : tab === "mine" ? (
        trackers.length === 0 ? <Card><EmptyState title="You are not tracking any scheme" body="Open a scheme and tap 'Track this scheme' to keep a document checklist and follow-up date." /></Card> : (
          <Card className="overflow-hidden"><ul className="divide-y divide-line">
            {trackers.map((t) => (
              <li key={t.id}><Link href={`/app/schemes/${t.scheme.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sand/60 sm:px-5">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.scheme.name}</p><p className="text-xs text-muted">{t.collectedDocuments.length}/{t.scheme.documents.length} documents{t.applicationRef ? ` · ref ${t.applicationRef}` : ""}{t.followUpDate ? ` · follow up ${t.followUpDate.toISOString().slice(0, 10)}` : ""}</p></div>
                <Badge tone={t.status === "APPROVED" ? "green" : t.status === "REJECTED" || t.status === "NOT_ELIGIBLE" ? "red" : "blue"}>{t.status.replace(/_/g, " ").toLowerCase()}</Badge>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link></li>
            ))}
          </ul></Card>
        )
      ) : (
        <>
          <UrlFilters filters={[
            { name: "q", type: "search", placeholder: "Search schemes" },
            { name: "category", type: "select", label: "Category", options: Object.entries(CATS).map(([value, label]) => ({ value, label })) },
            { name: "crop", type: "select", label: "Crop", options: crops.map((c) => ({ value: c.key, label: c.name })) },
            { name: "level", type: "select", label: "Level", options: [{ value: "CENTRAL", label: "Central" }, { value: "STATE", label: "Karnataka" }] },
            { name: "district", type: "select", label: "District", options: ["Dakshina Kannada", "Udupi", "Uttara Kannada"].map((d) => ({ value: d, label: d })) },
          ]} />
          {schemes.length === 0 ? <Card><EmptyState title="No schemes match" /></Card> : (
            <div className="grid gap-3 md:grid-cols-2">
              {schemes.map((s) => (
                <Link key={s.id} href={`/app/schemes/${s.slug}`} className="card block p-4 transition-colors hover:border-leaf-300">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{s.name}</p>
                    <Badge tone={s.level === "STATE" ? "brown" : "neutral"}>{s.level === "STATE" ? "Karnataka" : "Central"}</Badge>
                  </div>
                  {s.nameKn && <p className="text-sm text-muted">{s.nameKn}</p>}
                  <p className="mt-2 line-clamp-2 text-sm text-ink/80">{s.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {s.categories.slice(0, 3).map((c) => <Badge key={c}>{CATS[c] ?? c}</Badge>)}
                    {tracked.has(s.id) && <Badge tone="blue">Tracking</Badge>}
                    <span className="ml-auto text-[11px] text-muted">{s.lastVerifiedAt ? `Verified ${s.lastVerifiedAt.toISOString().slice(0, 10)}` : "Not yet verified"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
