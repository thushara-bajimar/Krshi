import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { serialize } from "@/lib/serialize";
import { PageHeader, Badge, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody, Stat } from "@/components/ui/card";
import { NoAccess, NoFarm } from "@/components/app/no-farm";
import { UrlFilters } from "@/components/app/url-filters";
import { BreakdownBars, IncomeExpenseChart } from "@/components/charts";
import { DeleteRecordButton } from "@/components/forms/delete-button";
import { AddLaborButton, EditLaborButton, PayButton } from "@/features/labor/actions";
import { PendingQueueList } from "@/offline/pending-list";
import { LinkButton } from "@/components/ui/button";
import { groupSum, monthlySeries } from "@/lib/calc/finance";
import { sumMoney } from "@/lib/calc/money";
import { pendingAmount } from "@/lib/calc/labor";
import { WAGE_UNIT, WORK_LABEL } from "@/lib/constants";
import { date, money, number, todayISO } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Labour" };

export default async function LaborPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  if (!ctx.can("finance:read")) return <NoAccess what="labour and wages" />;
  const sp = await searchParams;
  const farmId = ctx.farm.id;
  const today = new Date(todayISO() + "T00:00:00Z");
  const from = sp.from ? new Date(sp.from) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const to = sp.to ? new Date(sp.to) : today;
  const where: Prisma.LaborRecordWhereInput = {
    farmId, deletedAt: null, date: { gte: from, lte: to },
    ...(sp.worker ? { workerId: sp.worker } : {}), ...(sp.plot ? { plotId: sp.plot } : {}), ...(sp.work ? { taskCategory: sp.work } : {}),
    ...(sp.status ? { paymentStatus: sp.status as never } : {}),
  };
  const [records, pending, workers, plots] = await Promise.all([
    prisma.laborRecord.findMany({ where, include: { worker: true, plot: { include: { crop: true } }, payments: { orderBy: { date: "desc" } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.laborRecord.findMany({ where: { farmId, deletedAt: null, workStatus: "COMPLETED", paymentStatus: { not: "PAID" } }, include: { worker: true, plot: true }, orderBy: { date: "asc" } }),
    prisma.worker.findMany({ where: { farmId }, orderBy: { name: "asc" } }),
    prisma.plot.findMany({ where: { farmId }, orderBy: { name: "asc" } }),
  ]);
  const done = records.filter((r) => r.workStatus === "COMPLETED");
  const total = sumMoney(done.map((r) => Number(r.totalCost)));
  const paid = sumMoney(done.map((r) => Number(r.amountPaid)));
  const pendingTotal = sumMoney(pending.map((r) => pendingAmount(Number(r.totalCost), Number(r.amountPaid))));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const thisMonth = sumMoney(done.filter((r) => r.date >= monthStart).map((r) => Number(r.totalCost)));
  const series = monthlySeries(done.map((r) => ({ date: r.date, amount: Number(r.totalCost), category: "LABOR" })), [], from, to).map((m) => ({ ...m, income: 0 }));
  const byWorker = groupSum(done, (r) => r.worker?.name ?? r.workerLabel ?? "Unnamed group", (r) => Number(r.totalCost));
  const byPlot = groupSum(done, (r) => r.plot?.name ?? "Whole farm", (r) => Number(r.totalCost));
  const byCrop = groupSum(done, (r) => r.plot?.crop?.name ?? "Unassigned", (r) => Number(r.totalCost));
  const toBars = (o: Record<string, number>) => Object.entries(o).map(([name, value]) => ({ name, value }));
  const planned = records.filter((r) => r.workStatus === "PLANNED");

  return (
    <>
      <PageHeader title="Labour" subtitle="Work done, wages, and who still needs to be paid." actions={<>{ctx.can("finance:write") && <AddLaborButton />}<LinkButton href="/app/labor/workers" variant="outline"><Users className="h-4 w-4" />Workers</LinkButton></>} />
      <PendingQueueList entity="labor" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Labour this month" value={money(thisMonth, true)} />
        <Stat label="In selected period" value={money(total, true)} sub={`${done.length} records · ${date(from, { month: "short", year: "numeric" })} – ${date(to, { month: "short", year: "numeric" })}`} />
        <Stat label="Paid in period" value={money(paid, true)} tone="good" />
        <Stat label="Pending wages (all time)" value={money(pendingTotal, true)} tone={pendingTotal > 0 ? "warn" : "default"} sub={`${pending.length} unpaid record${pending.length === 1 ? "" : "s"}`} />
      </div>

      {pending.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Pending payments" subtitle="Oldest first" />
          <ul className="divide-y divide-line">
            {pending.map((r) => {
              const due = pendingAmount(Number(r.totalCost), Number(r.amountPaid));
              const who = r.worker?.name ?? r.workerLabel ?? `${r.workerCount} workers`;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{who}</p>
                    <p className="truncate text-xs text-muted">{WORK_LABEL[r.taskCategory]} · {date(r.date)}{r.plot ? ` · ${r.plot.name}` : ""}{Number(r.amountPaid) > 0 ? ` · paid ${money(Number(r.amountPaid))}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular font-semibold text-amber-800">{money(due)}</span>
                    {ctx.can("finance:write") && <PayButton id={r.id} pending={due} who={who} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Monthly labour expenditure" />
          <CardBody>{done.length ? <IncomeExpenseChart data={series} /> : <p className="text-sm text-muted">No completed work in this period.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="By worker" />
          <CardBody>{done.length ? <BreakdownBars data={toBars(byWorker)} /> : <p className="text-sm text-muted">—</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="By plot" />
          <CardBody>{done.length ? <BreakdownBars data={toBars(byPlot)} /> : <p className="text-sm text-muted">—</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="By crop" />
          <CardBody>{done.length ? <BreakdownBars data={toBars(byCrop)} /> : <p className="text-sm text-muted">—</p>}</CardBody>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Work records</h2>
      <UrlFilters
        filters={[
          { name: "worker", type: "select", label: "Worker", options: workers.map((w) => ({ value: w.id, label: w.name })) },
          { name: "plot", type: "select", label: "Plot", options: plots.map((p) => ({ value: p.id, label: p.name })) },
          { name: "work", type: "select", label: "Work", options: Object.entries(WORK_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "status", type: "select", label: "Payment", options: [{ value: "PENDING", label: "Pending" }, { value: "PARTIAL", label: "Partly paid" }, { value: "PAID", label: "Paid" }] },
          { name: "from", type: "date", label: "From" },
          { name: "to", type: "date", label: "To" },
        ]}
      />
      {records.length === 0 ? (
        <Card><EmptyState title="No work records in this period" body="Example: 3 workers × 1 day × ₹800 — KRSHI calculates ₹2,400 and tracks payment." action={ctx.can("finance:write") ? <AddLaborButton /> : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[100px_1fr_1fr_130px_110px_80px] gap-3 border-b border-line bg-sand/50 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid">
            <span>Date</span><span>Who</span><span>Work</span><span className="text-right">Calculation</span><span className="text-right">Total</span><span />
          </div>
          <ul className="divide-y divide-line">
            {records.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[100px_1fr_1fr_130px_110px_80px] md:items-center md:px-5">
                <span className="order-2 text-xs text-muted md:order-none md:text-sm md:text-ink">{date(r.date, { day: "numeric", month: "short", year: "2-digit" })}</span>
                <span className="order-1 text-sm font-medium md:order-none">{r.worker?.name ?? r.workerLabel ?? "Group"}{r.workStatus === "PLANNED" && <Badge tone="blue" className="ml-2">Planned</Badge>}</span>
                <span className="order-3 col-span-2 text-xs text-muted md:order-none md:col-span-1 md:text-sm md:text-ink">{WORK_LABEL[r.taskCategory]}{r.plot ? ` · ${r.plot.name}` : ""}</span>
                <span className="order-4 col-span-2 text-xs tabular text-muted md:order-none md:col-span-1 md:text-right">{r.workerCount > 1 ? `${r.workerCount} × ` : ""}{number(Number(r.units))} {WAGE_UNIT[r.wageType]} × {money(Number(r.rate))}{Number(r.additionalCost) ? ` + ${money(Number(r.additionalCost))}` : ""}</span>
                <span className="order-1 text-right md:order-none">
                  <span className="block text-sm font-semibold tabular">{money(Number(r.totalCost))}</span>
                  <Badge tone={r.paymentStatus === "PAID" ? "green" : r.paymentStatus === "PARTIAL" ? "amber" : "red"}>{r.paymentStatus === "PARTIAL" ? "Part paid" : r.paymentStatus.toLowerCase()}</Badge>
                </span>
                <span className="order-5 col-span-2 flex justify-end gap-1 md:order-none md:col-span-1">
                  {ctx.can("finance:write") && <><EditLaborButton record={serialize(r)} /><DeleteRecordButton iconOnly entity="labor" id={r.id} label="this work record" body="Its payment history will also be removed from totals." /></>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {planned.length > 0 && <p className="mt-3 text-xs text-muted">Planned work is not counted in totals until marked as done.</p>}
      <p className="mt-6 text-xs text-muted">Totals include only completed work recorded in KRSHI. <Link href="/app/reports" className="underline">Download a labour report</Link>.</p>
    </>
  );
}
