import Link from "next/link";
import type { Metadata } from "next";
import { Bug, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader, Badge, EmptyState, Notice } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { ReportIssueButton } from "@/features/issues/actions";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Crop issues" };

export default async function IssuesPage() {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const issues = await prisma.cropIssue.findMany({ where: { farmId: ctx.farm.id }, include: { plot: true, crop: true, _count: { select: { attachments: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Crop issues" subtitle="Record pests, diseases and other problems with photos, and keep track of expert advice." actions={ctx.can("write") ? <ReportIssueButton /> : undefined} />
      <Notice className="mb-4">KRSHI helps you document a problem clearly so an expert can help. It does not diagnose diseases or prescribe chemicals. For advice, contact your <Link href="/app/resources" className="font-medium underline">Raitha Samparka Kendra, KVK or the Kisan Call Centre (1800-180-1551)</Link>.</Notice>
      {issues.length === 0 ? (
        <Card><EmptyState icon={<Bug className="h-6 w-6" />} title="No issues reported" body="When you notice something wrong — yellowing, spots, nut fall, pests — record it with photos and when it started." action={ctx.can("write") ? <ReportIssueButton /> : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden"><ul className="divide-y divide-line">
          {issues.map((i) => (
            <li key={i.id}><Link href={`/app/issues/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sand/60 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.title}</p>
                <p className="truncate text-xs text-muted">{[i.crop?.name, i.plot?.name, `reported ${date(i.createdAt)}`, i._count.attachments ? `${i._count.attachments} photo${i._count.attachments > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</p>
              </div>
              <Badge tone={i.status === "RESOLVED" ? "green" : i.status === "MONITORING" ? "blue" : "amber"}>{i.status.toLowerCase()}</Badge>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link></li>
          ))}
        </ul></Card>
      )}
    </>
  );
}
