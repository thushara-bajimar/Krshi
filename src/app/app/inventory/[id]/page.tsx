import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { can } from "@/lib/authz";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { EditItemButton, StockButtons } from "@/features/stock/actions";
import { INVENTORY_LABEL } from "@/lib/constants";
import { date, money, number } from "@/lib/format";
import { daysUntil } from "@/lib/calc/inventory";
import { sumMoney } from "@/lib/calc/money";

export const metadata: Metadata = { title: "Inventory item" };
const TYPE = { PURCHASE: ["Purchase", "green"], USAGE: ["Used", "brown"], WASTAGE: ["Wastage", "red"], ADJUSTMENT: ["Count corrected", "neutral"] } as const;

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext();
  const item = await prisma.inventoryItem.findUnique({ where: { id }, include: { transactions: { include: { activity: { select: { id: true, type: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] } } });
  const m = item && ctx.farms.find((f) => f.id === item.farmId);
  if (!item || !m || item.deletedAt) notFound();
  const editable = can(m.role, "write") && ctx.farm?.id === item.farmId;
  const fin = can(m.role, "finance:read");
  const qty = Number(item.quantity);
  const bought = item.transactions.filter((t) => t.type === "PURCHASE");
  const used = item.transactions.filter((t) => t.type === "USAGE").reduce((a, t) => a + Number(t.quantity), 0);
  const spent = sumMoney(bought.map((t) => Number(t.totalCost ?? 0)));
  const dExp = daysUntil(item.expiryDate);
  return (
    <>
      <PageHeader back={<Link href="/app/inventory" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Inventory</Link>}
        title={item.name} subtitle={`${INVENTORY_LABEL[item.category]}${item.supplier ? ` · ${item.supplier}` : ""}`}
        actions={editable ? <><EditItemButton record={serialize(item)} /><DeleteRecordButton entity="inventoryItem" id={item.id} label={item.name} redirectTo="/app/inventory" body="The item and its history will be hidden. Expenses already recorded are kept." /></> : undefined} />
      {dExp != null && dExp <= 30 && <Notice tone={dExp < 0 ? "danger" : "warn"} className="mb-4">{dExp < 0 ? `Expired on ${date(item.expiryDate)}.` : `Expires on ${date(item.expiryDate)} (${dExp} days).`} Check the label before use.</Notice>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In stock" value={`${number(qty)} ${item.unit}`} tone={item.lowStockThreshold != null && qty <= Number(item.lowStockThreshold) ? "warn" : "default"} sub={item.lowStockThreshold != null ? `Alert at ${number(Number(item.lowStockThreshold))} ${item.unit}` : "No alert level set"} />
        <Stat label="Total used" value={`${number(used)} ${item.unit}`} />
        <Stat label="Purchases" value={bought.length} />
        {fin && <Stat label="Spent on purchases" value={money(spent, true)} />}
      </div>
      {editable && <div className="mb-5"><StockButtons item={{ id: item.id, name: item.name, unit: item.unit, quantity: qty }} /></div>}
      <Card>
        <CardHeader title="Stock history" subtitle="Every change to the quantity, newest first" />
        {item.transactions.length === 0 ? <EmptyState title="No stock movements yet" /> : (
          <ul className="divide-y divide-line">
            {item.transactions.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <Badge tone={TYPE[t.type][1]}>{TYPE[t.type][0]}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{t.notes ?? (t.supplier ? `From ${t.supplier}` : "")}{t.activity && <> · <Link href={`/app/diary/${t.activity.id}`} className="text-leaf-700 hover:underline">activity</Link></>}</p>
                  <p className="text-xs text-muted">{date(t.date)}{fin && t.totalCost ? ` · ${money(Number(t.totalCost))}` : ""}</p>
                </div>
                <span className={`tabular font-medium ${Number(t.delta) < 0 ? "text-clay-600" : "text-leaf-700"}`}>{Number(t.delta) > 0 ? "+" : ""}{number(Number(t.delta))} {item.unit}</span>
                {editable && t.type !== "ADJUSTMENT" && <DeleteRecordButton iconOnly entity="inventoryTxn" id={t.id} label="this stock entry" body="The stock quantity will be reversed. A linked purchase expense will also be removed." />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
