import Link from "next/link";
import type { Metadata } from "next";
import { Tractor } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { AddEquipmentButton } from "@/features/stock/actions";
import { date, money, relativeDays } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";

export const metadata: Metadata = { title: "Equipment" };

export default async function EquipmentPage() {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const items = await prisma.equipment.findMany({ where: { farmId: ctx.farm.id }, include: { logs: { orderBy: { date: "desc" } } }, orderBy: [{ status: "asc" }, { name: "asc" }] });
  const fin = ctx.can("finance:read");
  return (
    <>
      <PageHeader title="Equipment" subtitle="Sprayers, pumps, climbers and tools — maintenance, repairs and rentals." actions={ctx.can("write") ? <AddEquipmentButton /> : undefined} />
      {items.length === 0 ? (
        <Card><EmptyState icon={<Tractor className="h-6 w-6" />} title="No equipment recorded" action={ctx.can("write") ? <AddEquipmentButton /> : undefined} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((e) => {
            const due = e.logs.find((l) => l.nextDueDate)?.nextDueDate;
            const upkeep = sumMoney(e.logs.map((l) => Number(l.cost ?? 0)));
            return (
              <Link key={e.id} href={`/app/equipment/${e.id}`} className="card block p-4 transition-colors hover:border-leaf-300">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-sm capitalize text-muted">{e.category} · {e.ownership.toLowerCase()}{e.purchaseDate ? ` · since ${date(e.purchaseDate, { year: "numeric" })}` : ""}</p>
                  </div>
                  <Badge tone={e.status === "WORKING" ? "green" : e.status === "NEEDS_REPAIR" ? "amber" : "neutral"}>{e.status.replace("_", " ").toLowerCase()}</Badge>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {e.logs.length} log entr{e.logs.length === 1 ? "y" : "ies"}{fin && upkeep ? ` · upkeep ${money(upkeep, true)}` : ""}
                  {due ? ` · next service ${relativeDays(due).toLowerCase()}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
