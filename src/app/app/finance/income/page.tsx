import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { harvestOptions } from "@/server/harvest-options";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card, Stat } from "@/components/ui/card";
import { NoAccess, NoFarm } from "@/components/app/no-farm";
import { UrlFilters } from "@/components/app/url-filters";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddSaleButton, EditSaleButton } from "@/features/finance/actions";
import { PendingQueueList } from "@/offline/pending-list";
import { date, money, number } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";

export const metadata: Metadata = { title: "Sales & income" };

export default async function IncomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  if (!ctx.can("finance:read")) return <NoAccess what="sales and income" />;
  const sp = await searchParams;
  const where: Prisma.IncomeWhereInput = {
    farmId: ctx.farm.id, deletedAt: null, ...(sp.crop ? { cropId: sp.crop } : {}),
    ...(sp.status ? { paymentStatus: sp.status as never } : {}),
    ...(sp.from || sp.to ? { date: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to) } : {}) } } : {}),
    ...(sp.q ? { OR: [{ buyer: { contains: sp.q, mode: "insensitive" } }, { market: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, crops, harvests] = await Promise.all([
    prisma.income.findMany({ where, include: { crop: true, plot: true, harvest: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300 }),
    prisma.crop.findMany({ orderBy: { name: "asc" } }),
    harvestOptions(ctx.farm.id),
  ]);
  const gross = sumMoney(rows.map((r) => Number(r.grossAmount)));
  const net = sumMoney(rows.map((r) => Number(r.netAmount)));
  const due = sumMoney(rows.map((r) => Math.max(0, Number(r.netAmount) - Number(r.amountReceived ?? r.netAmount))));
  return (
    <>
      <PageHeader title="Sales & income" subtitle="Crop sales with transport and commission deducted, plus other farm income." actions={ctx.can("finance:write") ? <AddSaleButton harvests={harvests} /> : undefined} />
      <PendingQueueList entity="income" />
      <UrlFilters filters={[
        { name: "q", type: "search", placeholder: "Search buyer or market" },
        { name: "crop", type: "select", label: "Crop", options: crops.map((c) => ({ value: c.id, label: c.name })) },
        { name: "status", type: "select", label: "Payment", options: [{ value: "PENDING", label: "Not received" }, { value: "PARTIAL", label: "Part received" }, { value: "PAID", label: "Received" }] },
        { name: "from", type: "date", label: "From" },
        { name: "to", type: "date", label: "To" },
      ]} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Gross sales" value={money(gross, true)} />
        <Stat label="Net income" value={money(net, true)} tone="good" sub="After transport & deductions" />
        <Stat label="Still to receive" value={money(due, true)} tone={due > 0 ? "warn" : "default"} />
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState title="No sales recorded" body="Record each sale with quantity, price, buyer and transport cost to see what you really earned." action={ctx.can("finance:write") ? <AddSaleButton harvests={harvests} /> : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.source === "SALE" ? `${r.crop?.name ?? "Sale"}${r.quantity != null ? ` — ${number(Number(r.quantity))} ${r.unit ?? ""}` : ""}` : r.description ?? "Other income"}</p>
                  <p className="truncate text-xs text-muted">
                    {date(r.date)}{r.pricePerUnit ? ` · @ ${money(Number(r.pricePerUnit))}/${r.unit}` : ""}{r.buyer ? ` · ${r.buyer}` : ""}{r.market ? ` · ${r.market}` : ""}
                    {Number(r.transportCost) + Number(r.otherDeductions) > 0 ? ` · deductions ${money(Number(r.transportCost) + Number(r.otherDeductions))}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular text-leaf-800">{money(Number(r.netAmount))}</p>
                  {r.paymentStatus !== "PAID" && <Badge tone="amber">{r.paymentStatus === "PARTIAL" ? `Due ${money(Number(r.netAmount) - Number(r.amountReceived))}` : "Not received"}</Badge>}
                </div>
                {ctx.can("finance:write") && <span className="flex shrink-0"><EditSaleButton record={serialize(r)} harvests={harvests} /><DeleteRecordButton iconOnly entity="income" id={r.id} label="this sale" /></span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
