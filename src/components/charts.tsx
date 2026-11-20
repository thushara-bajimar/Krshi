"use client";
// Chart palette validated with the dataviz validator (lightness, chroma, CVD separation, contrast):
//   income/expense pair: #3b7036 / #c0782f — all checks pass.
//   multi-series lines: reference categorical order #2a78d6, #eb6834, #1baf7a, #eda100.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

export const SERIES = { income: "#3b7036", expense: "#c0782f", magnitude: "#3b7036" };
export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const AXIS = { fontSize: 12, fill: "#5b645d" };
const compact = (v: number) => (Math.abs(v) >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`);
const monthLabel = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

function TooltipBox({ active, payload, label, fmt = money, labelFmt }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; fmt?: (v: number) => string; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="mb-1 font-medium text-ink">{labelFmt ? labelFmt(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink/80">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium tabular text-ink">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function IncomeExpenseChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Monthly income and expenditure bar chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#ebe7de" />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compact} tick={AXIS} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<TooltipBox labelFmt={monthLabel} />} cursor={{ fill: "#f1ede4" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income (net)" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="Expenditure" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal magnitude bars (single hue, sorted) — used for category / crop / plot breakdowns. */
export function BreakdownBars({ data, height }: { data: { name: string; value: number }[]; height?: number }) {
  const rows = [...data].sort((a, b) => b.value - a.value);
  return (
    <div className="w-full" style={{ height: height ?? Math.max(120, rows.length * 34 + 20) }} role="img" aria-label="Breakdown bar chart">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={118} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1ede4" }} />
          <Bar dataKey="value" name="Amount" fill={SERIES.magnitude} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: "right", formatter: (v: number) => compact(v), fontSize: 11, fill: "#5b645d" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Price trend lines; one line per market (max 4, fixed hue order by series index). */
export function PriceTrendChart({ data, series, unit }: { data: Record<string, string | number | null>[]; series: string[]; unit: string }) {
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN")}`;
  const dLabel = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className="h-72 w-full" role="img" aria-label={`Modal price trend in ${unit}`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ebe7de" />
          <XAxis dataKey="date" tickFormatter={dLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={compact} tick={AXIS} axisLine={false} tickLine={false} width={56} domain={["auto", "auto"]} />
          <Tooltip content={<TooltipBox fmt={fmt} labelFmt={dLabel} />} cursor={{ stroke: "#9aa39b", strokeDasharray: "3 3" }} />
          {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
          {series.slice(0, 4).map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} name={s} stroke={CATEGORICAL[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small single-series trend used for soil parameters & yields. */
export function SimpleLine({ data, dataKey, name, fmt = (v: number) => String(v) }: { data: Record<string, unknown>[]; dataKey: string; name: string; fmt?: (v: number) => string }) {
  return (
    <div className="h-40 w-full" role="img" aria-label={`${name} over time`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ebe7de" />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
          <Tooltip content={<TooltipBox fmt={fmt} />} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={SERIES.magnitude} strokeWidth={2} dot={{ r: 4, fill: SERIES.magnitude, stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
