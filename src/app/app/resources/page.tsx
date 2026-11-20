import type { Metadata } from "next";
import { ExternalLink, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader, Badge, Notice } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { UrlFilters } from "@/components/app/url-filters";

export const metadata: Metadata = { title: "Help & experts" };
const TYPES: Record<string, string> = { helpline: "Helpline", department: "Government department", kvk: "Krishi Vigyan Kendra", research_institute: "Research institute", board: "Commodity board", portal: "Portal", lab: "Laboratory" };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ type?: string; crop?: string; q?: string }> }) {
  await pageContext();
  const sp = await searchParams;
  const rows = await prisma.resource.findMany({
    where: { ...(sp.type ? { type: sp.type } : {}), ...(sp.crop ? { OR: [{ crops: { has: sp.crop } }, { crops: { isEmpty: true } }] } : {}), ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }] } : {}) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const crops = await prisma.crop.findMany({ where: { isSystem: true } });
  return (
    <>
      <PageHeader title="Help & experts" subtitle="Where to get reliable agricultural advice in coastal Karnataka." />
      <Notice className="mb-4">This directory lists institutions only. KRSHI does not list individual officers or unverified phone numbers — contact details change, so confirm before visiting. For urgent crop problems call the <b>Kisan Call Centre: 1800-180-1551</b> (toll-free).</Notice>
      <UrlFilters filters={[
        { name: "q", type: "search", placeholder: "Search" },
        { name: "type", type: "select", label: "Type", options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
        { name: "crop", type: "select", label: "Crop", options: crops.map((c) => ({ value: c.key, label: c.name })) },
      ]} />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-2"><p className="font-semibold leading-snug">{r.name}</p><Badge>{TYPES[r.type] ?? r.type}</Badge></div>
            {r.district && <p className="text-xs text-muted">{r.district}</p>}
            <p className="mt-2 text-sm text-ink/80">{r.description}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {r.phone && <a href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1 font-medium text-leaf-700"><Phone className="h-4 w-4" />{r.phone}</a>}
              {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-leaf-700">Website <ExternalLink className="h-3.5 w-3.5" /></a>}
            </div>
            {r.crops.length > 0 && <p className="mt-2 text-xs text-muted">Crops: {r.crops.join(", ")}</p>}
            <p className="mt-2 text-[11px] text-muted">{r.lastVerifiedAt ? `Verified ${r.lastVerifiedAt.toISOString().slice(0, 10)}` : "Not yet verified in this build"}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
