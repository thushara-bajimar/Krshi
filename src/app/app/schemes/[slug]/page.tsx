import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, Notice, Provenance } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { SchemeTracker } from "@/features/schemes/tracker";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Scheme" };

export default async function SchemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await pageContext();
  const s = await prisma.scheme.findUnique({ where: { slug } });
  if (!s) notFound();
  const tracker = await prisma.schemeTracker.findUnique({ where: { userId_schemeId: { userId: ctx.user.id, schemeId: s.id } } });
  const sections: [string, string][] = [["What it is", s.description], ["Who can apply (summary)", s.eligibility], ["Benefits", s.benefits], ["How to apply", s.applicationProcess]];
  return (
    <>
      <PageHeader back={<Link href="/app/schemes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Schemes</Link>}
        title={s.name} subtitle={`${s.nameKn ? `${s.nameKn} · ` : ""}${s.department}`}
        actions={<a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>Official website <ExternalLink className="h-4 w-4" /></a>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Notice tone={s.lastVerifiedAt ? "info" : "warn"} title={s.lastVerifiedAt ? `Last verified ${date(s.lastVerifiedAt)}` : "Not yet verified against the official page"}>{s.verificationNote}</Notice>
          <Card>
            <CardBody className="space-y-5">
              {sections.map(([h, t]) => <section key={h}><h2 className="text-sm font-semibold">{h}</h2><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink/85">{t}</p></section>)}
              {s.deadline && <section><h2 className="text-sm font-semibold">Deadline</h2><p className="mt-1 text-sm">{s.deadline}</p></section>}
              <section>
                <h2 className="text-sm font-semibold">Documents usually needed</h2>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{s.documents.map((d) => <li key={d}>{d}</li>)}</ul>
              </section>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={s.level === "STATE" ? "brown" : "neutral"}>{s.level === "STATE" ? "Karnataka" : "Central government"}</Badge>
                <Badge tone={s.status === "ACTIVE" ? "green" : "amber"}>Status: {s.status === "UNKNOWN" ? "check portal" : s.status.toLowerCase()}</Badge>
                {s.crops.length > 0 && <Badge>Crops: {s.crops.join(", ")}</Badge>}
                <Badge>{s.districts.length ? s.districts.join(", ") : "All districts"}</Badge>
              </div>
            </CardBody>
            <div className="border-t border-line px-5 py-2.5"><Provenance kind="CURATED" source={s.sourceName} sourceUrl={s.sourceUrl} at={s.lastVerifiedAt ? `verified ${date(s.lastVerifiedAt)}` : "verification pending"} /></div>
          </Card>
        </div>
        <Card className="lg:self-start">
          <CardHeader title="My application tracker" subtitle="Private to you" />
          <CardBody><SchemeTracker schemeId={s.id} documents={s.documents} tracker={tracker ? serialize(tracker) : null} /></CardBody>
        </Card>
      </div>
    </>
  );
}
