"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, RefreshCw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";

export function FavoriteToggle({ kind, value, on, label }: { kind: "CROP" | "MARKET"; value: string; on: boolean; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => { const r = await fetch("/api/market/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, value }) }); if (r.ok) router.refresh(); }}
      className={cn("inline-flex items-center gap-1 rounded-md p-1 text-sm", on ? "text-amber-600" : "text-muted hover:text-ink")}
      aria-pressed={on}
      aria-label={`${on ? "Remove" : "Add"} ${label ?? value} ${on ? "from" : "to"} favourites`}
    >
      <Star className={cn("h-4 w-4", on && "fill-current")} />
    </button>
  );
}

export function RefreshPrices() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="outline" size="sm" loading={busy} onClick={async () => {
      setBusy(true);
      const r = await fetch("/api/market/refresh", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok) return toast.error(j.error ?? "Refresh failed");
      if (j.error) toast.error(`Provider error: ${j.error}`);
      else toast.success(j.refreshed ? `Fetched ${j.count} price rows` : "Already up to date");
      router.refresh();
    }}><RefreshCw className="h-4 w-4" />Refresh</Button>
  );
}

/** Compares potential net sale value across markets after transport — transport costs are entered by the farmer. */
export function NetComparison({ rows, unit }: { rows: { market: string; district: string; modal: number; date: string; sample: boolean }[]; unit: string }) {
  const [qty, setQty] = useState("1");
  const [transport, setTransport] = useState<Record<string, string>>({});
  const q = Number(qty) || 0;
  const computed = rows.map((r) => ({ ...r, gross: r.modal * q, net: r.modal * q - (Number(transport[r.market]) || 0) })).sort((a, b) => b.net - a.net);
  return (
    <div className="space-y-3">
      <div className="grid max-w-xs grid-cols-1">
        <Field label={`Quantity to sell (${unit.replace("Rs/", "").toLowerCase()})`} htmlFor="nq"><Input id="nq" type="number" inputMode="decimal" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">Market</th><th className="pr-3 text-right">Modal price</th><th className="pr-3 text-right">Gross</th><th className="pr-3">Your transport + costs (₹)</th><th className="text-right">Potential net</th></tr></thead>
          <tbody className="divide-y divide-line">
            {computed.map((r, i) => (
              <tr key={r.market}>
                <td className="py-2 pr-3"><span className="font-medium">{r.market}</span> <span className="text-xs text-muted">{r.district}</span>{r.sample && <Badge tone="red" className="ml-1">Sample</Badge>}</td>
                <td className="pr-3 text-right tabular">{money(r.modal)}</td>
                <td className="pr-3 text-right tabular">{money(r.gross, true)}</td>
                <td className="pr-3"><Input className="h-9 w-28" type="number" inputMode="decimal" aria-label={`Transport cost to ${r.market}`} value={transport[r.market] ?? ""} onChange={(e) => setTransport((t) => ({ ...t, [r.market]: e.target.value }))} placeholder="0" /></td>
                <td className={cn("text-right font-semibold tabular", i === 0 && q > 0 && "text-leaf-700")}>{money(r.net, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">The highest price is not always the best market: add your transport, commission, hamali and time costs. Modal price is the most common traded price on the reported date; actual prices depend on quality and the buyer.</p>
    </div>
  );
}

export function PriceAlerts({ alerts, crops, markets }: { alerts: { id: string; cropKey: string; market: string | null; direction: string; threshold: number }[]; crops: { key: string; name: string }[]; markets: string[] }) {
  const router = useRouter();
  const [v, setV] = useState({ cropKey: crops[0]?.key ?? "arecanut", market: "", direction: "ABOVE", threshold: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/market/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(j.fieldErrors?.threshold?.[0] ?? j.error ?? "Could not save");
    toast.success("Alert saved — you'll be notified when a reported price crosses it");
    setV((x) => ({ ...x, threshold: "" }));
    router.refresh();
  }
  async function remove(id: string) {
    await fetch(`/api/market/alerts?id=${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span><Bell className="mr-1 inline h-3.5 w-3.5 text-muted" />{crops.find((c) => c.key === a.cropKey)?.name ?? a.cropKey} {a.direction === "ABOVE" ? "≥" : "≤"} {money(a.threshold, true)}{a.market ? ` at ${a.market}` : " (any market)"}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Delete alert"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid grid-cols-2 gap-2">
        <Select aria-label="Crop" value={v.cropKey} onChange={(e) => setV({ ...v, cropKey: e.target.value })}>{crops.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select>
        <Select aria-label="Market" value={v.market} onChange={(e) => setV({ ...v, market: e.target.value })}><option value="">Any market</option>{markets.map((m) => <option key={m}>{m}</option>)}</Select>
        <Select aria-label="Direction" value={v.direction} onChange={(e) => setV({ ...v, direction: e.target.value })}><option value="ABOVE">Rises to</option><option value="BELOW">Falls to</option></Select>
        <Input aria-label="Price per quintal" type="number" inputMode="decimal" placeholder="₹ per quintal" value={v.threshold} onChange={(e) => setV({ ...v, threshold: e.target.value })} />
        <Button type="submit" size="sm" className="col-span-2">Add price alert</Button>
      </form>
    </div>
  );
}
