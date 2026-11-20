import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { NoAccess, NoFarm } from "@/components/app/no-farm";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddWorkerButton, EditWorkerButton } from "@/features/labor/actions";
import { sumMoney } from "@/lib/calc/money";
import { WAGE_LABEL, WORK_LABEL } from "@/lib/constants";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Workers" };

export default async function WorkersPage() {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  if (!ctx.can("finance:read")) return <NoAccess what="workers and wages" />;
  const workers = await prisma.worker.findMany({
    where: { farmId: ctx.farm.id },
    include: { labor: { where: { deletedAt: null, workStatus: "COMPLETED" }, include: { payments: true }, orderBy: { date: "desc" } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader back={<Link href="/app/labor" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Labour</Link>} title="Workers" subtitle="People who work on this farm, their usual wage and what they have been paid." actions={ctx.can("finance:write") ? <AddWorkerButton /> : undefined} />
      {workers.length === 0 ? (
        <Card><EmptyState title="No workers saved" body="Save regular workers to pick them quickly when recording labour and to see each person's pending wages." action={ctx.can("finance:write") ? <AddWorkerButton /> : undefined} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workers.map((w) => {
            const earned = sumMoney(w.labor.map((l) => Number(l.totalCost)));
            const paid = sumMoney(w.labor.map((l) => Number(l.amountPaid)));
            const lastPay = w.labor.flatMap((l) => l.payments).sort((a, b) => b.date.getTime() - a.date.getTime())[0];
            return (
              <Card key={w.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">{w.name}{!w.active && <Badge>Inactive</Badge>}</p>
                    <p className="text-sm text-muted">{WORK_LABEL[w.category]}{w.defaultWage ? ` · ${money(Number(w.defaultWage))} ${WAGE_LABEL[w.wageType].toLowerCase()}` : ""}</p>
                    {w.phone && <a href={`tel:${w.phone.replace(/\s/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-sm text-leaf-700"><Phone className="h-3.5 w-3.5" />{w.phone}</a>}
                  </div>
                  {ctx.can("finance:write") && <div className="flex gap-1"><EditWorkerButton record={serialize(w)} /><DeleteRecordButton iconOnly entity="worker" id={w.id} label={w.name} body="Workers with work records cannot be deleted — mark them inactive instead." /></div>}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-sand/50 p-3 text-center text-sm">
                  <div><dt className="text-xs text-muted">Earned</dt><dd className="font-semibold tabular">{money(earned, true)}</dd></div>
                  <div><dt className="text-xs text-muted">Paid</dt><dd className="font-semibold tabular text-leaf-700">{money(paid, true)}</dd></div>
                  <div><dt className="text-xs text-muted">Pending</dt><dd className={`font-semibold tabular ${earned - paid > 0 ? "text-amber-700" : ""}`}>{money(earned - paid, true)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">{w.labor.length} work record{w.labor.length === 1 ? "" : "s"}{w.labor[0] ? ` · last worked ${date(w.labor[0].date)}` : ""}{lastPay ? ` · last paid ${date(lastPay.date)}` : ""}</p>
                <Link href={`/app/labor?worker=${w.id}`} className="mt-1 inline-block text-sm font-medium text-leaf-700 hover:underline">View work & payment history</Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
