import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { aiConfigured } from "@/server/assistant/ai";
import { PageHeader, Badge, Notice } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Attachments } from "@/components/forms/attachments";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { EditIssueButton } from "@/features/issues/actions";
import { AssistButton } from "@/features/issues/assist";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Crop issue" };

export default async function IssuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const ctx = await pageContext();
  const i = await prisma.cropIssue.findUnique({ where: { id }, include: { plot: true, crop: true, attachments: true } });
  const m = i && ctx.farms.find((f) => f.id === i.farmId);
  if (!i || !m) notFound();
  const editable = can(m.role, "write") && ctx.farm?.id === i.farmId;
  const experts = await prisma.resource.findMany({ where: { OR: [{ type: { in: ["helpline", "kvk"] } }, ...(i.crop ? [{ crops: { has: i.crop.key } }] : [])] }, take: 5, orderBy: { type: "asc" } });
  return (
    <>
      <PageHeader back={<Link href="/app/issues" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Crop issues</Link>}
        title={i.title} subtitle={[i.crop?.name, i.plot?.name, `reported ${date(i.createdAt)}`].filter(Boolean).join(" · ")}
        actions={editable ? <><EditIssueButton record={serialize(i)} /><DeleteRecordButton entity="cropIssue" id={i.id} label="this issue" redirectTo="/app/issues" /></> : undefined} />
      {isNew && <Notice tone="success" className="mb-4">Issue saved. Add clear photos below — close-ups of affected parts and one of the whole plant.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2"><Badge tone={i.status === "RESOLVED" ? "green" : i.status === "MONITORING" ? "blue" : "amber"}>{i.status.toLowerCase()}</Badge>{i.symptoms.map((s) => <Badge key={s}>{s}</Badge>)}</div>
              <p className="whitespace-pre-wrap">{i.description}</p>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-muted">Started</dt><dd>{i.startedOn ? date(i.startedOn) : "—"}</dd></div>
                <div><dt className="text-xs text-muted">Affected</dt><dd>{i.affectedArea ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">Already tried</dt><dd>{i.previousTreatments ?? "—"}</dd></div>
              </dl>
            </CardBody>
          </Card>
          <Card><CardHeader title="Photos" /><CardBody><Attachments target="issue" targetId={i.id} items={i.attachments} editable={editable} /></CardBody></Card>
          <Card>
            <CardHeader title="AI observations" subtitle="Describes what is visible and possible causes to discuss — never a diagnosis or prescription" />
            <CardBody className="space-y-3">
              {i.aiNotes ? <div className="whitespace-pre-wrap rounded-lg bg-sand/50 p-3 text-sm leading-relaxed">{i.aiNotes}</div> : <p className="text-sm text-muted">No AI observations yet.</p>}
              {editable && <AssistButton id={i.id} hasPhotos={i.attachments.some((a) => a.mimeType.startsWith("image/"))} configured={aiConfigured()} />}
            </CardBody>
          </Card>
          {(i.expertAdvice || i.resolution) && (
            <Card><CardHeader title="Expert advice & outcome" subtitle="As recorded by you" /><CardBody className="space-y-3 text-sm">{i.expertAdvice && <p className="whitespace-pre-wrap"><b>Advice:</b> {i.expertAdvice}</p>}{i.resolution && <p className="whitespace-pre-wrap"><b>Outcome:</b> {i.resolution}</p>}</CardBody></Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Get expert help" />
            <CardBody className="space-y-3 text-sm">
              <p>Show this page (or a printout) to your Raitha Samparka Kendra, horticulture office or KVK. Before visiting, note:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                <li>How many plants are affected and where in the plot</li>
                <li>When it started and how fast it is spreading</li>
                <li>Recent rain, irrigation, manure or sprays</li>
                <li>Photos: affected part close up, whole plant, and a healthy plant for comparison</li>
              </ul>
              <ul className="divide-y divide-line border-t border-line pt-1">
                {experts.map((e) => (
                  <li key={e.id} className="py-2">
                    <p className="font-medium">{e.name}</p>
                    {e.phone && <a href={`tel:${e.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1 text-leaf-700"><Phone className="h-3.5 w-3.5" />{e.phone}</a>}
                    {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-leaf-700 underline">{e.website}</a>}
                  </li>
                ))}
              </ul>
              <Link href="/app/resources" className="block font-medium text-leaf-700 hover:underline">All help & experts →</Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
