import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card, Stat } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { AddItemButton, StockButtons } from "@/features/stock/actions";
import { INVENTORY_LABEL } from "@/lib/constants";
import { daysUntil, isLowStock } from "@/lib/calc/inventory";
import { date, money, number } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const { category } = await searchParams;
  const items = await prisma.inventoryItem.findMany({
    where: { farmId: ctx.farm.id, deletedAt: null, ...(category ? { category: category as never } : {}) },
    include: { transactions: { where: { type: "PURCHASE", unitCost: { not: null } }, orderBy: { date: "desc" }, take: 1 } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const low = items.filter((i) => isLowStock(Number(i.quantity), i.lowStockThreshold == null ? null : Number(i.lowStockThreshold)));
  const expiring = items.filter((i) => { const d = daysUntil(i.expiryDate); return d != null && d <= 30 && Number(i.quantity) > 0; });
  const value = items.reduce((a, i) => a + Number(i.quantity) * Number(i.transactions[0]?.unitCost ?? 0), 0);
  const cats = [...new Set(items.map((i) => i.category))];

  return (
    <>
      <PageHeader title="Inventory" subtitle="Fertilizers, chemicals, seeds, tools and supplies in stock." actions={ctx.can("write") ? <AddItemButton /> : undefined} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Items" value={items.length} />
        <Stat label="Low stock" value={low.length} tone={low.length ? "warn" : "default"} />
        <Stat label="Expiring ≤ 30 days" value={expiring.length} tone={expiring.length ? "warn" : "default"} sub={ctx.can("finance:read") && value ? `Stock value ≈ ${money(value, true)} (last purchase price)` : undefined} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/app/inventory" className={`rounded-full border px-3 py-1 text-sm ${!category ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white"}`}>All</Link>
        {Object.entries(INVENTORY_LABEL).filter(([k]) => cats.includes(k as never) || k === category).map(([k, l]) => (
          <Link key={k} href={`/app/inventory?category=${k}`} className={`rounded-full border px-3 py-1 text-sm ${category === k ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white"}`}>{l}</Link>
        ))}
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={<Package className="h-6 w-6" />} title="No inventory items" body="Track stock of copper sulphate, manure, seeds and more. Activities can deduct what they use." action={ctx.can("write") ? <AddItemButton /> : undefined} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((i) => {
            const qty = Number(i.quantity);
            const isLow = low.includes(i);
            const dExp = daysUntil(i.expiryDate);
            return (
              <Card key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/app/inventory/${i.id}`} className="min-w-0">
                    <p className="truncate font-semibold hover:underline">{i.name}</p>
                    <p className="text-xs text-muted">{INVENTORY_LABEL[i.category]}{i.supplier ? ` · ${i.supplier}` : ""}</p>
                  </Link>
                  <div className="text-right">
                    <p className={`text-xl font-semibold tabular ${isLow ? "text-amber-700" : ""}`}>{number(qty)} <span className="text-sm font-normal text-muted">{i.unit}</span></p>
                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                      {isLow && <Badge tone="amber">Low stock</Badge>}
                      {dExp != null && dExp <= 30 && <Badge tone={dExp < 0 ? "red" : "amber"}>{dExp < 0 ? "Expired" : `Expires ${date(i.expiryDate, { day: "numeric", month: "short" })}`}</Badge>}
                    </div>
                  </div>
                </div>
                {ctx.can("write") && ctx.farm && <div className="mt-3"><StockButtons compact item={{ id: i.id, name: i.name, unit: i.unit, quantity: qty }} /></div>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
