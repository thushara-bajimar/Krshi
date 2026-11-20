import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Attachments } from "@/components/forms/attachments";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { EditExpenseButton } from "@/features/finance/actions";
import { EXPENSE_LABEL } from "@/lib/constants";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Expense" };

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext();
  const e = await prisma.expense.findUnique({ where: { id }, include: { plot: true, crop: true, attachments: true, activity: true } });
  const m = e && ctx.farms.find((f) => f.id === e.farmId);
  if (!e || !m || e.deletedAt || !can(m.role, "finance:read")) notFound();
  const editable = can(m.role, "finance:write") && ctx.farm?.id === e.farmId;
  return (
    <>
      <PageHeader back={<Link href="/app/finance/expenses" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Expenses</Link>} title={money(Number(e.amount))} subtitle={`${EXPENSE_LABEL[e.category]} · ${date(e.date)}`}
        actions={editable ? <><EditExpenseButton record={serialize(e)} /><DeleteRecordButton entity="expense" id={e.id} label="this expense" redirectTo="/app/finance/expenses" /></> : undefined} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[["Description", e.description], ["Shop / vendor", e.vendor], ["Paid by", e.paymentMethod], ["Plot", e.plot?.name], ["Crop", e.crop?.name], ["From activity", e.activity ? <Link key="a" href={`/app/diary/${e.activity.id}`} className="text-leaf-700 hover:underline">Open activity</Link> : null]].map(([k, v]) => (
              <div key={String(k)}><dt className="text-xs text-muted">{k}</dt><dd>{v ?? "—"}</dd></div>
            ))}
          </dl>
        </CardBody></Card>
        <Card><CardHeader title="Receipt / bill" /><CardBody><Attachments target="expense" targetId={e.id} items={e.attachments} editable={editable} /></CardBody></Card>
      </div>
    </>
  );
}
