import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddLogButton, EditEquipmentButton } from "@/features/stock/actions";
import { date, money, number } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";

export const metadata: Metadata = { title: "Equipment" };

export default async function EquipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext();
  const e = await prisma.equipment.findUnique({ where: { id }, include: { logs: { orderBy: { date: "desc" } } } });
  const m = e && ctx.farms.find((f) => f.id === e.farmId);
  if (!e || !m) notFound();
  const editable = can(m.role, "write") && ctx.farm?.id === e.farmId;
  const fin = can(m.role, "finance:read");
  const sum = (t: string) => sumMoney(e.logs.filter((l) => l.type === t).map((l) => Number(l.cost ?? 0)));
  const hours = e.logs.reduce((a, l) => a + Number(l.hours ?? 0), 0);
  return (
    <>
      <PageHeader back={<Link href="/app/equipment" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Equipment</Link>}
        title={e.name} subtitle={`${e.category} · ${e.ownership.toLowerCase()} · ${e.status.replace("_", " ").toLowerCase()}`}
        actions={editable ? <><AddLogButton id={e.id} name={e.name} /><EditEquipmentButton record={serialize(e)} /><DeleteRecordButton entity="equipment" id={e.id} label={e.name} redirectTo="/app/equipment" body="Its maintenance log will be deleted too. Expenses already recorded are kept." /></> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {fin && <Stat label="Purchase cost" value={e.purchaseCost ? money(Number(e.purchaseCost), true) : "—"} sub={e.purchaseDate ? date(e.purchaseDate) : undefined} />}
        {fin && <Stat label="Maintenance + repairs" value={money(sum("MAINTENANCE") + sum("REPAIR"), true)} />}
        {fin && <Stat label="Rental" value={money(sum("RENTAL"), true)} />}
        <Stat label="Hours logged" value={number(hours)} />
      </div>
      {(e.rentalInfo || e.notes) && <Card className="mb-5"><CardBody className="space-y-1 text-sm">{e.rentalInfo && <p><b>Rental:</b> {e.rentalInfo}</p>}{e.notes && <p className="text-muted">{e.notes}</p>}</CardBody></Card>}
      <Card>
        <CardHeader title="History" />
        {e.logs.length === 0 ? <EmptyState title="No maintenance, repair or usage logged yet" /> : (
          <ul className="divide-y divide-line">
            {e.logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <Badge tone={l.type === "REPAIR" ? "amber" : l.type === "RENTAL" ? "blue" : "neutral"}>{l.type.toLowerCase()}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{l.description ?? "—"}</p>
                  <p className="text-xs text-muted">{date(l.date)}{l.hours ? ` · ${number(Number(l.hours))} h` : ""}{l.nextDueDate ? ` · next due ${date(l.nextDueDate)}` : ""}</p>
                </div>
                {fin && l.cost != null && <span className="tabular font-medium">{money(Number(l.cost))}</span>}
                {editable && <DeleteRecordButton iconOnly entity="equipmentLog" id={l.id} label="this log entry" body="A linked expense will also be removed." />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
