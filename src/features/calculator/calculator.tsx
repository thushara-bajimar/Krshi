"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookmarkPlus, Calculator as CalcIcon, ClipboardCheck, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/misc";
import { useAppData } from "@/components/app/app-data";
import { ActivityFormDialog } from "@/features/farm-forms";
import { calculateDosage, type DosageInput } from "@/lib/calc/dosage";
import { AREA_TO_SQM, convertArea, convertQuantity, round, unitDimension, type AreaUnit, type QuantityUnit } from "@/lib/units";
import { AREA_UNIT_LABEL } from "@/lib/constants";
import { money, number } from "@/lib/format";

type Product = { id: string; name: string; category: string; dose: number | null; doseUnit: string | null; doseBasis: string | null; doseBasisArea: number | null; doseBasisUnit: string | null; sourceReference: string | null; notes: string | null };
const AREA_OPTS = Object.entries(AREA_UNIT_LABEL);
const DOSE_UNITS: QuantityUnit[] = ["kg", "g", "l", "ml"];

export function DosageCalculator({ products }: { products: Product[] }) {
  const app = useAppData();
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({ basis: "per_area", doseUnit: "kg", basisArea: "1", basisUnit: "ACRE", targetUnit: app.farm?.areaUnit ?? "ACRE", basisLitres: "1", basisPlants: "1", priceUnit: "kg", priceFor: "1", availUnit: "kg", sprayUnit: "ACRE", sprayArea: "1" });
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  function pickPlot(id: string) {
    const p = app.plots.find((x) => x.id === id);
    setV((x) => ({ ...x, plotId: id, ...(p ? { targetArea: String(p.area), targetUnit: p.areaUnit, plantCount: p.plantCount ? String(p.plantCount) : x.plantCount ?? "" } : {}) }));
  }
  function pickProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return set("productRef", "");
    setV((x) => ({
      ...x, productRef: id, productName: p.name, source: p.sourceReference ?? "",
      ...(p.dose != null ? { dose: String(p.dose), doseUnit: p.doseUnit ?? "kg", basis: p.doseBasis ?? "per_area", ...(p.doseBasis === "per_area" ? { basisArea: String(p.doseBasisArea ?? 1), basisUnit: (p.doseBasisUnit ?? "ACRE").toUpperCase() } : p.doseBasis === "per_litre" ? { basisLitres: String(p.doseBasisArea ?? 1) } : { basisPlants: String(p.doseBasisArea ?? 1) }) } : {}),
    }));
  }
  function pickStock(id: string) {
    const it = app.inventory.find((i) => i.id === id);
    setV((x) => ({ ...x, stockId: id, ...(it && DOSE_UNITS.includes(it.unit as QuantityUnit) ? { available: String(it.quantity), availUnit: it.unit } : {}) }));
  }

  const n = (k: string) => (v[k] === undefined || v[k] === "" ? undefined : Number(v[k]));
  const { result, error } = useMemo(() => {
    if (!n("dose")) return { result: null, error: null };
    try {
      const input: DosageInput = {
        dose: n("dose")!,
        doseUnit: v.doseUnit as QuantityUnit,
        basis: v.basis === "per_area" ? { kind: "per_area", area: n("basisArea") ?? 1, areaUnit: v.basisUnit as AreaUnit } : v.basis === "per_litre" ? { kind: "per_litre", litres: n("basisLitres") ?? 1 } : { kind: "per_plant", plants: n("basisPlants") ?? 1 },
        targetArea: n("targetArea"),
        targetAreaUnit: v.targetUnit as AreaUnit,
        waterLitres: n("waterLitres"),
        plantCount: n("plantCount"),
        sprayVolumePerArea: n("sprayLitres") ? { litres: n("sprayLitres")!, area: n("sprayArea") ?? 1, areaUnit: v.sprayUnit as AreaUnit } : undefined,
        available: n("available") != null ? { quantity: n("available")!, unit: v.availUnit as QuantityUnit } : undefined,
        price: n("price") ? { amount: n("price")!, per: n("priceFor") ?? 1, unit: v.priceUnit as QuantityUnit } : undefined,
      };
      return { result: calculateDosage(input), error: null };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  async function saveProduct() {
    if (!v.productName) return toast.error("Enter the product name first");
    const body = {
      name: v.productName, category: "input", dose: v.dose, doseUnit: v.doseUnit, doseBasis: v.basis,
      doseBasisArea: v.basis === "per_area" ? v.basisArea : v.basis === "per_litre" ? v.basisLitres : v.basisPlants,
      doseBasisUnit: v.basis === "per_area" ? v.basisUnit : v.basis === "per_litre" ? "litre" : "plant", sourceReference: v.source,
    };
    const r = await fetch("/api/input-products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(j.fieldErrors?.sourceReference?.[0] ?? j.error ?? "Could not save");
    toast.success("Saved to your product references");
    router.refresh();
  }
  async function deleteProduct(id: string) {
    await fetch(`/api/input-products/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const sourceOk = (v.source ?? "").trim().length >= 5;
  const basisLabel = v.basis === "per_area" ? `per ${v.basisArea || 1} ${AREA_UNIT_LABEL[v.basisUnit]}` : v.basis === "per_litre" ? `per ${v.basisLitres || 1} litre of water` : `per ${v.basisPlants || 1} plant`;
  const stockQty = (qty: number) => {
    const unit = app.inventory.find((i) => i.id === v.stockId)?.unit;
    if (!unit || unitDimension(unit) !== unitDimension(v.doseUnit)) return "";
    return String(round(convertQuantity(qty, v.doseUnit as QuantityUnit, unit as QuantityUnit), 3));
  };
  const activityDefaults = result
    ? {
        plotId: v.plotId ?? "", productName: v.productName ?? "", quantity: String(result.display.value), quantityUnit: result.display.unit,
        areaCovered: v.targetArea ?? "", areaUnit: v.targetUnit, waterQuantity: result.waterLitres != null ? String(result.waterLitres) : "",
        dilution: `${v.dose} ${v.doseUnit} ${basisLabel}`, cost: result.costEstimate != null ? String(result.costEstimate) : "",
        sourceReference: v.source ?? "", inventoryItemId: v.stockId ?? "",
        inventoryQuantity: stockQty(result.productQuantity),
        type: "FERTILIZER",
      }
    : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Notice tone="warn" title="KRSHI does not recommend doses">
          Enter the dose exactly as given on the <b>product label</b> or by your <b>KVK, agriculture/horticulture officer or university package of practices</b>. The calculator only scales that dose to your area, water and plants. For pesticides, always follow the label, use protective equipment and respect the waiting period before harvest.
        </Notice>
        <Card>
          <CardHeader title="1. Where and what" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Plot" htmlFor="c-plot" optional hint="Fills in area and plant count">
              <Select id="c-plot" value={v.plotId ?? ""} onChange={(e) => pickPlot(e.target.value)}>
                <option value="">— Enter manually —</option>
                {app.plots.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.area} {AREA_UNIT_LABEL[p.areaUnit]})</option>)}
              </Select>
            </Field>
            <Field label="Saved product" htmlFor="c-prod" optional>
              <Select id="c-prod" value={v.productRef ?? ""} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">— New product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Product name" htmlFor="c-name"><Input id="c-name" value={v.productName ?? ""} onChange={(e) => set("productName", e.target.value)} placeholder="As on the label" /></Field>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <Field label="Area to treat" htmlFor="c-area"><Input id="c-area" type="number" inputMode="decimal" step="any" value={v.targetArea ?? ""} onChange={(e) => set("targetArea", e.target.value)} /></Field>
              <Field label="Unit" htmlFor="c-areau"><Select id="c-areau" value={v.targetUnit} onChange={(e) => set("targetUnit", e.target.value)}>{AREA_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="2. Verified dose" subtitle="From the label or an expert — required" />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dose basis">
              {[["per_area", "Per area"], ["per_litre", "Per litre of water (spray)"], ["per_plant", "Per plant / palm"]].map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={v.basis === k} onClick={() => set("basis", k)} className={`rounded-full border px-3 py-1.5 text-sm ${v.basis === k ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white hover:bg-sand"}`}>{l}</button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_100px_1fr]">
              <Field label="Dose" htmlFor="c-dose"><Input id="c-dose" type="number" inputMode="decimal" step="any" value={v.dose ?? ""} onChange={(e) => set("dose", e.target.value)} /></Field>
              <Field label="Unit" htmlFor="c-du"><Select id="c-du" value={v.doseUnit} onChange={(e) => set("doseUnit", e.target.value)}>{DOSE_UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
              {v.basis === "per_area" && (
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <Field label="Per area" htmlFor="c-ba"><Input id="c-ba" type="number" inputMode="decimal" step="any" value={v.basisArea} onChange={(e) => set("basisArea", e.target.value)} /></Field>
                  <Field label="Unit" htmlFor="c-bu"><Select id="c-bu" value={v.basisUnit} onChange={(e) => set("basisUnit", e.target.value)}>{AREA_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                </div>
              )}
              {v.basis === "per_litre" && <Field label="Per litres of water" htmlFor="c-bl"><Input id="c-bl" type="number" inputMode="decimal" step="any" value={v.basisLitres} onChange={(e) => set("basisLitres", e.target.value)} /></Field>}
              {v.basis === "per_plant" && <Field label="Per number of plants" htmlFor="c-bp"><Input id="c-bp" type="number" inputMode="numeric" value={v.basisPlants} onChange={(e) => set("basisPlants", e.target.value)} /></Field>}
            </div>
            <Field label="Source of this dose" htmlFor="c-src" error={v.dose && !sourceOk ? "Say where the dose comes from before using the result" : undefined} hint="e.g. 'Product label, batch 23A', 'KVK Mangaluru advice 12 Jun', 'UAHS package of practices 2023'">
              <Input id="c-src" value={v.source ?? ""} onChange={(e) => set("source", e.target.value)} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="3. Water, plants, stock and price" subtitle="Optional" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {v.basis !== "per_plant" && (
              <div className="grid grid-cols-[1fr_1fr_100px] gap-2 sm:col-span-2">
                <Field label="Spray volume (litres)" htmlFor="c-sv" hint="Water your sprayer uses…"><Input id="c-sv" type="number" inputMode="decimal" step="any" value={v.sprayLitres ?? ""} onChange={(e) => set("sprayLitres", e.target.value)} /></Field>
                <Field label="…per area" htmlFor="c-sa"><Input id="c-sa" type="number" inputMode="decimal" step="any" value={v.sprayArea} onChange={(e) => set("sprayArea", e.target.value)} /></Field>
                <Field label="Unit" htmlFor="c-su"><Select id="c-su" value={v.sprayUnit} onChange={(e) => set("sprayUnit", e.target.value)}>{AREA_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              </div>
            )}
            {v.basis === "per_litre" && <Field label="Or total water (litres)" htmlFor="c-w"><Input id="c-w" type="number" inputMode="decimal" step="any" value={v.waterLitres ?? ""} onChange={(e) => set("waterLitres", e.target.value)} /></Field>}
            {v.basis === "per_plant" && <Field label="Number of plants" htmlFor="c-pc"><Input id="c-pc" type="number" inputMode="numeric" value={v.plantCount ?? ""} onChange={(e) => set("plantCount", e.target.value)} /></Field>}
            <Field label="Stock on hand" htmlFor="c-stock" optional>
              <Select id="c-stock" value={v.stockId ?? ""} onChange={(e) => pickStock(e.target.value)}>
                <option value="">— Enter manually —</option>
                {app.inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Available quantity" htmlFor="c-av"><Input id="c-av" type="number" inputMode="decimal" step="any" value={v.available ?? ""} onChange={(e) => set("available", e.target.value)} /></Field>
              <Field label="Unit" htmlFor="c-avu"><Select id="c-avu" value={v.availUnit} onChange={(e) => set("availUnit", e.target.value)}>{DOSE_UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-[1fr_80px_90px] gap-2 sm:col-span-2">
              <Field label="Price (₹)" htmlFor="c-pr"><Input id="c-pr" type="number" inputMode="decimal" step="any" value={v.price ?? ""} onChange={(e) => set("price", e.target.value)} /></Field>
              <Field label="for" htmlFor="c-pf"><Input id="c-pf" type="number" inputMode="decimal" step="any" value={v.priceFor} onChange={(e) => set("priceFor", e.target.value)} /></Field>
              <Field label="Unit" htmlFor="c-pu"><Select id="c-pu" value={v.priceUnit} onChange={(e) => set("priceUnit", e.target.value)}>{DOSE_UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader title="Result" icon={<CalcIcon className="h-5 w-5" />} />
          <CardBody>
            {!result && !error && <p className="text-sm text-muted">Enter the area and a verified dose to see the quantity needed.</p>}
            {error && <Notice tone="danger">{error}</Notice>}
            {result && (
              <div className="space-y-4">
                <div className={sourceOk ? "" : "opacity-50"}>
                  <p className="text-xs uppercase tracking-wide text-muted">Product needed</p>
                  <p className="text-3xl font-semibold tabular text-leaf-900">{number(result.display.value)} <span className="text-lg">{result.display.unit}</span></p>
                  {result.waterLitres != null && <p className="mt-1 text-sm">in <b className="tabular">{number(result.waterLitres)} litres</b> of water</p>}
                  {result.costEstimate != null && <p className="mt-1 text-sm">Estimated cost <b className="tabular">{money(result.costEstimate)}</b></p>}
                </div>
                {result.shortfall ? <Notice tone="warn">Not enough stock — short by <b>{number(result.shortfall.value)} {result.shortfall.unit}</b>.</Notice> : n("available") != null && <Notice tone="success">Enough stock available.</Notice>}
                <details className="rounded-lg bg-sand/60 p-3 text-xs" open>
                  <summary className="cursor-pointer font-medium">How this was calculated</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 tabular text-muted">{result.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                  {v.targetArea && <p className="mt-2 text-muted">Area check: {v.targetArea} {AREA_UNIT_LABEL[v.targetUnit]} = {number(round(convertArea(Number(v.targetArea), v.targetUnit as AreaUnit, "SQ_M"), 1))} m² (1 {AREA_UNIT_LABEL[v.targetUnit]} = {number(AREA_TO_SQM[v.targetUnit as AreaUnit])} m²)</p>}
                </details>
                <div className={`flex items-start gap-2 rounded-lg p-2 text-xs ${sourceOk ? "bg-leaf-50 text-leaf-900" : "bg-amber-50 text-amber-950"}`}>
                  {sourceOk ? <ClipboardCheck className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
                  {sourceOk ? <>Dose source: {v.source}</> : <>Add the dose source to save or record this.</>}
                </div>
                <div className="flex flex-col gap-2">
                  {app.perms.write && (
                    <ActivityFormDialog defaults={activityDefaults} trigger={(o) => <Button onClick={o} disabled={!sourceOk}>Record as activity</Button>} />
                  )}
                  <Button variant="outline" onClick={saveProduct} disabled={!sourceOk}><BookmarkPlus className="h-4 w-4" />Save product & dose for next time</Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
        {products.length > 0 && (
          <Card>
            <CardHeader title="Your saved products" />
            <ul className="divide-y divide-line">
              {products.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.dose != null ? `${p.dose} ${p.doseUnit} ${p.doseBasis === "per_area" ? `per ${p.doseBasisArea} ${String(p.doseBasisUnit).toLowerCase()}` : p.doseBasis === "per_litre" ? `per ${p.doseBasisArea} L` : `per ${p.doseBasisArea} plant`}` : "No dose saved"}</p>
                    {p.sourceReference && <Badge tone="brown" className="mt-1">Source: {p.sourceReference}</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
