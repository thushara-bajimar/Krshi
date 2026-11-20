import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, Notice } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Attachments } from "@/components/forms/attachments";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { EditActivityButton } from "@/features/diary/actions";
import { ACTIVITY_LABEL, AREA_UNIT_LABEL, EXPENSE_LABEL, WORK_LABEL } from "@/lib/constants";
import { date, dateTime, money, number } from "@/lib/format";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext();
  const a = await prisma.activity.findUnique({
    where: { id },
    include: { plot: true, crop: true, attachments: true, inventoryTxns: { include: { item: true } }, expenses: { where: { deletedAt: null } }, labor: { where: { deletedAt: null }, include: { worker: true } } },
  });
  const m = a && ctx.farms.find((f) => f.id === a.farmId);
  if (!a || !m || a.deletedAt) notFound();
  const fin = can(m.role, "finance:read");
  const editable = can(m.role, "write") && ctx.farm?.id === a.farmId;
  const rows: [string, React.ReactNode][] = [
    ["Date", date(a.date)],
    ["Plot", a.plot ? <Link href={`/app/plots/${a.plot.id}`} className="text-leaf-700 hover:underline">{a.plot.name}</Link> : "Whole farm"],
    ["Crop", a.crop?.name ?? "—"],
    ["Product", a.productName ?? "—"],
    ["Product type", a.productCategory ?? "—"],
    ["Quantity", a.quantity != null ? `${number(Number(a.quantity))} ${a.quantityUnit ?? ""}` : "—"],
    ["Area covered", a.areaCovered != null ? `${number(Number(a.areaCovered))} ${AREA_UNIT_LABEL[a.areaUnit ?? "ACRE"]}` : "—"],
    ["Concentration / dilution", a.dilution ?? "—"],
    ["Water", a.waterQuantity != null ? `${number(Number(a.waterQuantity))} ${a.waterUnit ?? "l"}` : "—"],
    ["Done by", a.laborDetails ?? "—"],
    ["Next follow-up", a.followUpDate ? date(a.followUpDate) : "—"],
  ];
  if (fin) rows.push(["Cost", a.cost != null ? money(Number(a.cost)) : "—"]);

  return (
    <>
      <PageHeader
        back={<Link href="/app/diary" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Diary</Link>}
        title={`${ACTIVITY_LABEL[a.type]}${a.productName ? ` — ${a.productName}` : ""}`}
        subtitle={`${date(a.date)}${a.plot ? ` · ${a.plot.name}` : ""}`}
        actions={editable ? <><EditActivityButton record={serialize(a)} /><DeleteRecordButton entity="activity" id={a.id} label="this activity" redirectTo="/app/diary" body={a.inventoryTxns.some((t) => t.type === "USAGE") ? "Stock deducted by this activity will be returned to inventory. Linked expenses are kept (delete them separately if needed)." : "Linked expenses and labour records are kept."} /></> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-sm">{v}</dd></div>
                ))}
              </dl>
              {a.description && <div className="mt-4 border-t border-line pt-4"><p className="text-xs text-muted">Description</p><p className="mt-1 whitespace-pre-wrap text-sm">{a.description}</p></div>}
              {a.notes && <div className="mt-4"><p className="text-xs text-muted">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm">{a.notes}</p></div>}
            </CardBody>
          </Card>
          {a.sourceReference && <Notice title="Recommendation source">{a.sourceReference}</Notice>}
          <Card>
            <CardHeader title="Photos & documents" />
            <CardBody><Attachments target="activity" targetId={a.id} items={a.attachments} editable={editable} /></CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Linked records" />
            <CardBody className="space-y-3 text-sm">
              {a.inventoryTxns.length === 0 && a.expenses.length === 0 && a.labor.length === 0 && <p className="text-muted">None.</p>}
              {a.inventoryTxns.map((t) => (
                <p key={t.id}><Badge tone="brown">Stock</Badge> <Link href={`/app/inventory/${t.itemId}`} className="hover:underline">{t.type === "USAGE" ? "Used" : t.type.toLowerCase()} {number(Number(t.quantity))} {t.item.unit} {t.item.name}</Link></p>
              ))}
              {fin && a.expenses.map((e) => <p key={e.id}><Badge tone="amber">Expense</Badge> {EXPENSE_LABEL[e.category]} {money(Number(e.amount))}</p>)}
              {fin && a.labor.map((l) => <p key={l.id}><Badge tone="blue">Labour</Badge> {l.worker?.name ?? l.workerLabel} · {WORK_LABEL[l.taskCategory]} {money(Number(l.totalCost))}</p>)}
            </CardBody>
          </Card>
          <p className="px-1 text-xs text-muted">Recorded {dateTime(a.createdAt)}{a.updatedAt.getTime() - a.createdAt.getTime() > 2000 ? ` · edited ${dateTime(a.updatedAt)}` : ""} · version {a.version}</p>
        </div>
      </div>
    </>
  );
}
