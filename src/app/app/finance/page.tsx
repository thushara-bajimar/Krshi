import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { loadFinance } from "@/server/finance";
import { harvestOptions } from "@/server/harvest-options";
import { PageHeader, Notice } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { NoAccess, NoFarm } from "@/components/app/no-farm";
import { UrlFilters } from "@/components/app/url-filters";
import { BreakdownBars, IncomeExpenseChart } from "@/components/charts";
import { AddExpenseButton, AddSaleButton } from "@/features/finance/actions";
import { EXPENSE_LABEL } from "@/lib/constants";
import { periodRange } from "@/lib/calc/finance";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  if (!ctx.can("finance:read")) return <NoAccess what="money records" />;
  const sp = await searchParams;
  const period = (sp.period ?? "year") as "month" | "season" | "year" | "custom";
  const range = sp.from && sp.to ? { from: new Date(sp.from), to: new Date(sp.to) } : periodRange(period === "custom" ? "year" : period);
  const scope = sp.scope === "all" ? ctx.farms.filter((f) => ["OWNER", "MANAGER", "FINANCE_VIEWER"].includes(f.role)).map((f) => f.id) : [ctx.farm.id];
  // previous comparable period for historical comparison
  const len = range.to.getTime() - range.from.getTime();
  const prevRange = { from: new Date(range.from.getTime() - len - 86400000), to: new Date(range.from.getTime() - 86400000) };
  const [fin, prev, plots, crops, harvests] = await Promise.all([
    loadFinance({ farmIds: scope, ...range, plotId: sp.plot, cropId: sp.crop }),
    loadFinance({ farmIds: scope, ...prevRange, plotId: sp.plot, cropId: sp.crop }),
    prisma.plot.findMany({ where: { farmId: ctx.farm.id }, orderBy: { name: "asc" } }),
    prisma.crop.findMany({ orderBy: { name: "asc" } }),
    harvestOptions(ctx.farm.id),
  ]);
  const bars = (o: Record<string, number>, label?: Record<string, string>) => Object.entries(o).map(([k, value]) => ({ name: label?.[k] ?? k, value }));
  const empty = fin.counts.expenses + fin.counts.incomes + fin.counts.labor === 0;
  const delta = (cur: number, before: number) => (before ? `${cur >= before ? "▲" : "▼"} ${Math.abs(Math.round(((cur - before) / Math.abs(before)) * 100))}% vs previous period` : "No data for previous period");

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle={`${date(range.from)} – ${date(range.to)} · ${scope.length > 1 ? "all your farms" : ctx.farm.name}`}
        actions={ctx.can("finance:write") ? <><AddExpenseButton /><AddSaleButton harvests={harvests} /></> : undefined}
      />
      <UrlFilters
        filters={[
          { name: "period", type: "select", label: "Period", options: [{ value: "month", label: "This month" }, { value: "season", label: "This season" }, { value: "year", label: "This financial year (Apr–Mar)" }] },
          { name: "from", type: "date", label: "From" },
          { name: "to", type: "date", label: "To" },
          { name: "plot", type: "select", label: "Plot", options: plots.map((p) => ({ value: p.id, label: p.name })) },
          { name: "crop", type: "select", label: "Crop", options: crops.map((c) => ({ value: c.id, label: c.name })) },
          ...(ctx.farms.length > 1 ? [{ name: "scope", type: "select" as const, label: "Farms", options: [{ value: "all", label: "All my farms" }] }] : []),
        ]}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recorded income (net)" value={money(fin.summary.totalIncome, true)} tone="good" sub={delta(fin.summary.totalIncome, prev.summary.totalIncome)} href="/app/finance/income" />
        <Stat label="Recorded expenditure" value={money(fin.summary.totalExpense, true)} sub={delta(fin.summary.totalExpense, prev.summary.totalExpense)} href="/app/finance/expenses" />
        <Stat label="Recorded net income" value={money(fin.summary.net, true)} tone={fin.summary.net < 0 ? "bad" : "good"} />
        <Stat label="Pending" value={money(fin.wagesPending + fin.receivable, true)} tone={fin.wagesPending + fin.receivable > 0 ? "warn" : "default"} sub={`Wages ${money(fin.wagesPending, true)} · to receive ${money(fin.receivable, true)}`} />
      </div>
      {empty ? (
        <Notice>Nothing recorded for this period. Add expenses, labour and sales to see your farm's money picture. KRSHI never estimates figures you have not entered.</Notice>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader title="Monthly income vs expenditure" subtitle="Expenditure includes labour from the labour book" />
            <CardBody><IncomeExpenseChart data={fin.monthly} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Where the money went" subtitle="By expense category" />
            <CardBody><BreakdownBars data={bars(fin.byCategory, { ...EXPENSE_LABEL, LABOR: "Labour" })} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Labour vs inputs" subtitle="Inputs = fertilizer, pesticide, seeds, irrigation" />
            <CardBody>
              <BreakdownBars data={[{ name: "Labour", value: fin.laborTotal }, { name: "Inputs", value: fin.inputTotal }, { name: "Everything else", value: Math.max(0, fin.summary.totalExpense - fin.laborTotal - fin.inputTotal) }]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Costs by crop" />
            <CardBody><BreakdownBars data={bars(fin.byCrop)} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Income by crop" />
            <CardBody>{Object.keys(fin.incomeByCrop).length ? <BreakdownBars data={bars(fin.incomeByCrop)} /> : <p className="text-sm text-muted">No sales recorded in this period.</p>}</CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Costs by plot" />
            <CardBody><BreakdownBars data={bars(fin.byPlot)} /></CardBody>
          </Card>
        </div>
      )}
      <p className="mt-6 text-xs text-muted">All figures are calculated from records in KRSHI — {fin.counts.expenses} expenses, {fin.counts.labor} labour records and {fin.counts.incomes} sales in this period. <Link href="/app/reports" className="underline">Create a report</Link>.</p>
    </>
  );
}
