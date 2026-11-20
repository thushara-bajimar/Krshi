import type { Metadata } from "next";
import { Wheat } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { NoFarm } from "@/components/app/no-farm";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddHarvestButton, EditHarvestButton } from "@/features/stock/actions";
import { harvestRemaining, yieldPerArea, costPerUnit } from "@/lib/calc/yield";
import { sumMoney } from "@/lib/calc/money";
import { date, money, number } from "@/lib/format";
import { convertArea, type AreaUnit } from "@/lib/units";

export const metadata: Metadata = { title: "Harvests" };

export default async function HarvestsPage() {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const farmId = ctx.farm.id;
  const fin = ctx.can("finance:read");
  const [harvests, expenses, labor] = await Promise.all([
    prisma.harvest.findMany({ where: { farmId, deletedAt: null }, include: { crop: true, plot: true, sales: { where: { deletedAt: null } } }, orderBy: { date: "desc" } }),
    fin ? prisma.expense.findMany({ where: { farmId, deletedAt: null }, select: { amount: true, cropId: true, plotId: true, date: true } }) : [],
    fin ? prisma.laborRecord.findMany({ where: { farmId, deletedAt: null, workStatus: "COMPLETED" }, select: { totalCost: true, plotId: true, date: true, plot: { select: { cropId: true } } } }) : [],
  ]);

  // Yearly yield summary per crop & unit (only same-unit records are added together)
  type Row = { crop: string; cropId: string; year: number; unit: string; qty: number; sold: number; income: number; plots: Map<string, { area: number; unit: AreaUnit }> };
  const groups = new Map<string, Row>();
  for (const h of harvests) {
    const y = h.date.getUTCFullYear();
    const k = `${h.cropId}|${y}|${h.unit}`;
    const g = groups.get(k) ?? { crop: h.crop.name, cropId: h.cropId, year: y, unit: h.unit, qty: 0, sold: 0, income: 0, plots: new Map() };
    g.qty += Number(h.quantity);
    g.sold += h.sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0);
    g.income += h.sales.reduce((a, s) => a + Number(s.netAmount), 0);
    if (h.plot) g.plots.set(h.plot.id, { area: Number(h.plot.area), unit: h.plot.areaUnit as AreaUnit });
    groups.set(k, g);
  }
  const summary = [...groups.values()].sort((a, b) => b.year - a.year || a.crop.localeCompare(b.crop));
  const costFor = (cropId: string, year: number) => sumMoney([
    ...expenses.filter((e) => e.cropId === cropId && e.date.getUTCFullYear() === year).map((e) => Number(e.amount)),
    ...labor.filter((l) => l.plot?.cropId === cropId && l.date.getUTCFullYear() === year).map((l) => Number(l.totalCost)),
  ]);

  return (
    <>
      <PageHeader title="Harvests & yield" subtitle="What was harvested, what is sold, and what remains." actions={ctx.can("write") ? <AddHarvestButton /> : undefined} />
      {harvests.length === 0 ? (
        <Card><EmptyState icon={<Wheat className="h-6 w-6" />} title="No harvests recorded" body="Record each harvest by plot. Link sales to a harvest to track remaining stock and yield per acre." action={ctx.can("write") ? <AddHarvestButton /> : undefined} /></Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader title="Yield summary by crop and year" subtitle="Yield per acre uses the area of plots with harvest records. Missing harvests are not estimated." />
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">Crop</th><th className="pr-3">Year</th><th className="pr-3 text-right">Harvested</th><th className="pr-3 text-right">Per acre</th><th className="pr-3 text-right">Sold</th><th className="pr-3 text-right">Remaining</th>{fin && <><th className="pr-3 text-right">Sale income</th><th className="text-right">Cost per {"unit"}</th></>}</tr></thead>
                <tbody className="divide-y divide-line">
                  {summary.map((g) => {
                    const area = [...g.plots.values()].reduce((a, p) => a + convertArea(p.area, p.unit, "ACRE"), 0);
                    const perAcre = area > 0 ? yieldPerArea(g.qty, area, "ACRE") : null;
                    const cpu = fin ? costPerUnit(costFor(g.cropId, g.year), g.qty) : null;
                    return (
                      <tr key={`${g.cropId}${g.year}${g.unit}`}>
                        <td className="py-2.5 pr-3 font-medium">{g.crop}</td><td className="pr-3">{g.year}</td>
                        <td className="pr-3 text-right tabular">{number(g.qty)} {g.unit}</td>
                        <td className="pr-3 text-right tabular">{perAcre != null ? `${number(perAcre)} ${g.unit}` : "—"}</td>
                        <td className="pr-3 text-right tabular">{number(g.sold)}</td>
                        <td className="pr-3 text-right tabular">{number(harvestRemaining(g.qty, g.sold))}</td>
                        {fin && <><td className="pr-3 text-right tabular">{money(g.income, true)}</td><td className="text-right tabular">{cpu != null ? `${money(cpu)}/${g.unit}` : "—"}</td></>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {fin && <p className="mt-3 text-xs text-muted">Cost per unit = that year's recorded expenses and labour for the crop ÷ harvested quantity. Incomplete if costs or harvests were not recorded.</p>}
            </CardBody>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Harvest records" />
            <ul className="divide-y divide-line">
              {harvests.map((h) => {
                const sold = h.sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0);
                const rem = harvestRemaining(Number(h.quantity), sold);
                return (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.crop.name} — {number(Number(h.quantity))} {h.unit}{h.grade ? ` · ${h.grade}` : ""}</p>
                      <p className="truncate text-xs text-muted">{date(h.date)}{h.plot ? ` · ${h.plot.name}` : ""}{h.storage ? ` · stored: ${h.storage}` : ""}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      {sold > 0 ? <p className="text-muted">Sold {number(sold)} {h.unit}</p> : null}
                      <Badge tone={rem > 0 ? "amber" : "green"}>{rem > 0 ? `${number(rem)} ${h.unit} unsold` : "All sold"}</Badge>
                    </div>
                    {ctx.can("write") && <span className="flex shrink-0"><EditHarvestButton record={serialize(h)} /><DeleteRecordButton iconOnly entity="harvest" id={h.id} label="this harvest" body="Sales linked to it are kept but will no longer be linked." /></span>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Notice className="mt-4">To record a sale from a harvest, use <b>Record sale</b> and choose the harvest — KRSHI checks you are not selling more than was harvested.</Notice>
        </>
      )}
    </>
  );
}
