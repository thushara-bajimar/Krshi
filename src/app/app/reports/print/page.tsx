import type { Metadata } from "next";
import { pageContext } from "@/server/context";
import { NoFarm } from "@/components/app/no-farm";
import { loadReport, parseReportParams, REPORT_TYPES } from "@/server/reports";
import { PrintButton } from "@/features/reports/print-button";
import { Notice } from "@/components/ui/misc";
import { LogoMark } from "@/components/logo";
import { groupSum } from "@/lib/calc/finance";
import { sumMoney } from "@/lib/calc/money";
import { ACTIVITY_LABEL, AREA_UNIT_LABEL, EXPENSE_LABEL, INVENTORY_LABEL, WAGE_UNIT, WORK_LABEL } from "@/lib/constants";
import { date, dateTime, money, number } from "@/lib/format";

export const metadata: Metadata = { title: "Report" };

function Table({ head, rows, foot, right = [] }: { head: string[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; right?: number[] }) {
  if (!rows.length) return <p className="text-sm text-muted">No records in this period.</p>;
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead><tr className="border-b-2 border-ink/70 text-left">{head.map((h, i) => <th key={h} className={`py-1.5 pr-2 font-semibold ${right.includes(i) ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line align-top">{r.map((c, j) => <td key={j} className={`py-1.5 pr-2 ${right.includes(j) ? "text-right tabular" : ""}`}>{c}</td>)}</tr>)}</tbody>
      {foot && <tfoot><tr className="border-t-2 border-ink/70 font-semibold">{foot.map((c, j) => <td key={j} className={`py-1.5 pr-2 ${right.includes(j) ? "text-right tabular" : ""}`}>{c}</td>)}</tr></tfoot>}
    </table>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="mb-7 break-inside-avoid-page"><h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">{title}</h2>{children}</section>;

export default async function PrintReport({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageContext();
  if (!ctx.farm) return <NoFarm />;
  const p = parseReportParams(await searchParams, ctx.farm.id);
  let r;
  try {
    r = await loadReport(ctx.user.id, p);
  } catch (e) {
    return <Notice tone="danger">{(e as Error).message}</Notice>;
  }
  const f = r.fin;
  const all = p.type === "farm";
  const show = (t: string) => all || p.type === t;
  const scope = [r.plot?.name, r.crop?.name].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 print:p-0 sm:p-10">
      <div className="no-print mb-6 flex items-center justify-between gap-3 rounded-lg bg-sand p-3 text-sm"><span>Use Print → “Save as PDF” to keep a copy.</span><PrintButton /></div>
      <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-leaf-900 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{REPORT_TYPES[p.type]}</p>
          <h1 className="text-2xl font-semibold">{r.farm.name}</h1>
          <p className="text-sm text-muted">{[r.farm.village, r.farm.taluk, r.farm.district].filter(Boolean).join(", ")}{r.farm.totalArea ? ` · ${number(Number(r.farm.totalArea))} ${AREA_UNIT_LABEL[r.farm.areaUnit]}s` : ""}</p>
          <p className="mt-1 text-sm"><b>Period:</b> {date(r.range.from)} – {date(r.range.to)}{scope ? ` · ${scope}` : ""}</p>
        </div>
        <div className="text-right text-xs text-muted"><LogoMark className="ml-auto mb-1 h-8 w-8" />KRSHI<br />Generated {dateTime(r.generatedAt)}<br />for {ctx.user.name}</div>
      </header>
      {r.farm.isDemo && <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs">DEMO FARM — all figures are illustrative.</p>}

      {f && (show("farm") || show("expense") || show("income") || show("labor") || show("crop")) && (
        <Section title="Summary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Recorded income (net)", money(f.summary.totalIncome)], ["Recorded expenditure", money(f.summary.totalExpense)], ["Recorded net income", money(f.summary.net)], ["Labour", money(f.laborTotal)]].map(([k, v]) => (
              <div key={k} className="rounded border border-line p-2"><p className="text-[11px] text-muted">{k}</p><p className="font-semibold tabular">{v}</p></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Totals are calculated only from records entered in KRSHI. Wages pending: {money(f.wagesPending)} · sale amounts not yet received: {money(f.receivable)}.</p>
        </Section>
      )}

      {all && (
        <Section title="Plots">
          <Table head={["Plot", "Crop", "Area", "Status"]} rows={r.plots.map((pl) => [pl.name, [pl.crop?.name, pl.variety].filter(Boolean).join(" · ") || "—", `${number(Number(pl.area))} ${AREA_UNIT_LABEL[pl.areaUnit]}`, pl.status.toLowerCase()])} />
        </Section>
      )}

      {f && (show("expense") || show("crop")) && (
        <Section title="Expenditure by category">
          <Table head={["Category", "Amount"]} right={[1]} rows={Object.entries(f.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k === "LABOR" ? "Labour (from labour book)" : EXPENSE_LABEL[k] ?? k, money(v)])} foot={["Total", money(f.summary.totalExpense)]} />
        </Section>
      )}
      {f && show("crop") && (
        <Section title="By crop">
          <Table head={["Crop", "Expenditure", "Income (net)", "Net"]} right={[1, 2, 3]} rows={[...new Set([...Object.keys(f.byCrop), ...Object.keys(f.incomeByCrop)])].map((c) => [c, money(f.byCrop[c] ?? 0), money(f.incomeByCrop[c] ?? 0), money((f.incomeByCrop[c] ?? 0) - (f.byCrop[c] ?? 0))])} />
        </Section>
      )}
      {f && show("expense") && (
        <Section title="Expense entries">
          <Table head={["Date", "Category", "Description", "Plot", "Amount"]} right={[4]} rows={f.expenses.map((e) => [date(e.date), EXPENSE_LABEL[e.category], e.description ?? "", e.plot?.name ?? "", money(Number(e.amount))])} foot={["", "", "", "Total", money(sumMoney(f.expenses.map((e) => Number(e.amount))))]} />
        </Section>
      )}
      {f && show("labor") && (
        <Section title="Labour">
          <Table head={["Date", "Worker(s)", "Work", "Calculation", "Total", "Paid", "Status"]} right={[4, 5]} rows={f.labor.map((l) => [date(l.date), l.worker?.name ?? l.workerLabel ?? `${l.workerCount} workers`, `${WORK_LABEL[l.taskCategory] ?? l.taskCategory}${l.plot ? ` · ${l.plot.name}` : ""}`, `${l.workerCount > 1 ? `${l.workerCount} × ` : ""}${number(Number(l.units))} ${WAGE_UNIT[l.wageType]} × ${money(Number(l.rate))}`, money(Number(l.totalCost)), money(Number(l.amountPaid)), l.paymentStatus.toLowerCase()])} foot={["", "", "", "Total", money(f.laborTotal), money(sumMoney(f.labor.map((l) => Number(l.amountPaid)))), ""]} />
          {p.type === "labor" && <div className="mt-3"><Table head={["Worker", "Earned"]} right={[1]} rows={Object.entries(groupSum(f.labor, (l) => l.worker?.name ?? l.workerLabel ?? "Group", (l) => Number(l.totalCost))).map(([k, v]) => [k, money(v)])} /></div>}
        </Section>
      )}
      {f && (show("income") || all) && (
        <Section title="Sales & income">
          <Table head={["Date", "Crop / source", "Qty", "Rate", "Gross", "Deductions", "Net", "Buyer"]} right={[2, 3, 4, 5, 6]} rows={f.incomes.map((i) => [date(i.date), i.crop?.name ?? i.description ?? "Other", i.quantity != null ? `${number(Number(i.quantity))} ${i.unit ?? ""}` : "", i.pricePerUnit != null ? money(Number(i.pricePerUnit)) : "", money(Number(i.grossAmount)), money(Number(i.transportCost) + Number(i.otherDeductions)), money(Number(i.netAmount)), i.buyer ?? ""])} foot={["", "", "", "", "", "Total", money(f.summary.totalIncome), ""]} />
        </Section>
      )}
      {show("harvest") && (
        <Section title="Harvests">
          <Table head={["Date", "Crop", "Plot", "Quantity", "Grade", "Sold"]} right={[3, 5]} rows={r.harvests.map((h) => [date(h.date), h.crop.name, h.plot?.name ?? "", `${number(Number(h.quantity))} ${h.unit}`, h.grade ?? "", number(h.sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0))])} />
        </Section>
      )}
      {show("activity") && (
        <Section title="Activities">
          <Table head={["Date", "Activity", "Plot", "Product / quantity", "Done by", ...(r.finOk ? ["Cost"] : [])]} right={r.finOk ? [5] : []} rows={r.activities.map((a) => [date(a.date), ACTIVITY_LABEL[a.type], a.plot?.name ?? "", [a.productName, a.quantity != null ? `${number(Number(a.quantity))} ${a.quantityUnit ?? ""}` : null, a.dilution].filter(Boolean).join(" · "), a.laborDetails ?? "", ...(r.finOk ? [a.cost != null ? money(Number(a.cost)) : ""] : [])])} />
        </Section>
      )}
      {show("inventory") && (
        <Section title="Inventory">
          <Table head={["Item", "Category", "In stock", "Purchased", "Used", "Wasted"]} right={[2, 3, 4, 5]} rows={r.inventory.map((i) => [i.name, INVENTORY_LABEL[i.category], `${number(Number(i.quantity))} ${i.unit}`, ...(["PURCHASE", "USAGE", "WASTAGE"] as const).map((t) => number(i.transactions.filter((x) => x.type === t).reduce((a, x) => a + Number(x.quantity), 0)))])} />
        </Section>
      )}
      <Section title="Notes">
        <div className="h-20 rounded border border-dashed border-line" />
      </Section>
      <footer className="border-t border-line pt-2 text-[11px] text-muted">KRSHI farm report. Figures reflect records entered by the farm team; they are not audited accounts.</footer>
    </div>
  );
}
