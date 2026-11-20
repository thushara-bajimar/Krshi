"use client";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export function ReportBuilder({ types, farms, plots, crops, defaultFarm, finance }: { types: Record<string, string>; farms: { id: string; name: string }[]; plots: { id: string; name: string }[]; crops: { id: string; name: string }[]; defaultFarm: string; finance: boolean }) {
  const [v, setV] = useState({ type: finance ? "farm" : "activity", period: "year", from: "", to: "", farm: defaultFarm, plot: "", crop: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const qs = new URLSearchParams(Object.entries(v).filter(([, x]) => x) as [string, string][]).toString();
  const finTypes = ["farm", "expense", "labor", "crop", "income"];
  const csvable = v.type !== "farm" && v.type !== "crop";
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Report" htmlFor="r-type"><Select id="r-type" value={v.type} onChange={set("type")}>{Object.entries(types).filter(([k]) => finance || !finTypes.includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Period" htmlFor="r-period"><Select id="r-period" value={v.period} onChange={set("period")}><option value="month">This month</option><option value="season">This season</option><option value="year">This financial year (Apr–Mar)</option><option value="custom">Custom dates</option></Select></Field>
        {farms.length > 1 && <Field label="Farm" htmlFor="r-farm"><Select id="r-farm" value={v.farm} onChange={set("farm")}>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>}
        {v.period === "custom" && <><Field label="From" htmlFor="r-from"><Input id="r-from" type="date" value={v.from} onChange={set("from")} /></Field><Field label="To" htmlFor="r-to"><Input id="r-to" type="date" value={v.to} onChange={set("to")} /></Field></>}
        {v.farm === defaultFarm && <Field label="Plot" htmlFor="r-plot" optional><Select id="r-plot" value={v.plot} onChange={set("plot")}><option value="">All plots</option>{plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}
        <Field label="Crop" htmlFor="r-crop" optional><Select id="r-crop" value={v.crop} onChange={set("crop")}><option value="">All crops</option>{crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`/app/reports/print?${qs}`} target="_blank" rel="noopener" className={buttonClass("primary", "lg")}><Printer className="h-4 w-4" />Open printable report (save as PDF)</a>
        {csvable && <a href={`/api/reports/csv?${qs}`} className={buttonClass("outline", "lg")}><Download className="h-4 w-4" />Download CSV</a>}
      </div>
      <p className="text-xs text-muted">The printable report opens in a new tab — use your browser's Print → “Save as PDF”. CSV files open in Excel or Google Sheets.</p>
    </div>
  );
}
