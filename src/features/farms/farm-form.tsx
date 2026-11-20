"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LocateFixed } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { MapView } from "@/components/map";
import { farmSchema } from "@/lib/validation/schemas";
import { AREA_UNIT_LABEL, DISTRICTS, DISTRICT_NAMES } from "@/lib/constants";

type FarmRec = { id: string; name: string; district: string; taluk: string | null; village: string | null; location: string | null; latitude: number | null; longitude: number | null; totalArea: number | null; areaUnit: string; description: string | null };

export function FarmFormDialog({ trigger, farm, defaultOpen }: { trigger: (open: () => void) => React.ReactNode; farm?: FarmRec; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!defaultOpen);
  const init = () => ({
    name: farm?.name ?? "", district: farm?.district ?? "Dakshina Kannada", taluk: farm?.taluk ?? "", village: farm?.village ?? "", location: farm?.location ?? "",
    latitude: farm?.latitude?.toString() ?? "", longitude: farm?.longitude?.toString() ?? "", totalArea: farm?.totalArea?.toString() ?? "", areaUnit: farm?.areaUnit ?? "ACRE", description: farm?.description ?? "",
  });
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = farmSchema.safeParse(v);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      setErrors(fe);
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch(farm ? `/api/farms/${farm.id}` : "/api/farms", { method: farm ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).catch(() => null);
    setBusy(false);
    if (!res) return setErr("Could not reach the server. Farms can only be created online.");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error ?? "Could not save");
    toast.success(farm ? "Farm updated" : "Farm created — now add its plots");
    setOpen(false);
    if (!farm) router.push(`/app/farms/${j.farm.id}`);
    router.refresh();
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location is not available on this device");
    navigator.geolocation.getCurrentPosition(
      (p) => setV((x) => ({ ...x, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => toast.error("Could not get your location. You can tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const point = v.latitude && v.longitude ? { lat: Number(v.latitude), lng: Number(v.longitude) } : null;
  return (
    <>
      {trigger(() => { setV(init()); setErrors({}); setOpen(true); })}
      <Modal open={open} onOpenChange={setOpen} title={farm ? "Edit farm" : "Add a farm"} wide>
        <form onSubmit={save} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Farm name" htmlFor="fn" error={errors.name} className="sm:col-span-2">
              <Input id="fn" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kedila arecanut garden" aria-invalid={!!errors.name} />
            </Field>
            <Field label="District" htmlFor="fd" error={errors.district}>
              <Select id="fd" value={v.district} onChange={(e) => setV((p) => ({ ...p, district: e.target.value, taluk: "" }))}>
                {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Taluk" htmlFor="ft" optional>
              <Select id="ft" value={v.taluk} onChange={(e) => set("taluk", e.target.value)}>
                <option value="">—</option>
                {(DISTRICTS[v.district] ?? []).map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Village" htmlFor="fv" optional><Input id="fv" value={v.village} onChange={(e) => set("village", e.target.value)} /></Field>
            <Field label="Address / landmark" htmlFor="fl" optional><Input id="fl" value={v.location} onChange={(e) => set("location", e.target.value)} /></Field>
            <Field label="Total area" htmlFor="fa" optional error={errors.totalArea}><Input id="fa" type="number" inputMode="decimal" step="any" value={v.totalArea} onChange={(e) => set("totalArea", e.target.value)} /></Field>
            <Field label="Area unit" htmlFor="fu">
              <Select id="fu" value={v.areaUnit} onChange={(e) => set("areaUnit", e.target.value)}>
                {Object.entries(AREA_UNIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Map location <span className="font-normal text-muted">(optional)</span></p>
              <Button type="button" size="sm" variant="ghost" onClick={useMyLocation}><LocateFixed className="h-4 w-4" />Use my location</Button>
            </div>
            <MapView value={point} onChange={(p) => setV((x) => ({ ...x, latitude: String(p.lat), longitude: String(p.lng) }))} height={220} />
            <p className="text-xs text-muted">Tap the map to mark your farm. Used for farm-level weather. Your location is private and never shown to other users unless you share the farm.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" htmlFor="flat" error={errors.latitude}><Input id="flat" inputMode="decimal" value={v.latitude} onChange={(e) => set("latitude", e.target.value)} /></Field>
              <Field label="Longitude" htmlFor="flng" error={errors.longitude}><Input id="flng" inputMode="decimal" value={v.longitude} onChange={(e) => set("longitude", e.target.value)} /></Field>
            </div>
          </div>
          <Field label="Description" htmlFor="fdesc" optional><Textarea id="fdesc" value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
          {err && <Notice tone="danger">{err}</Notice>}
          <div className="flex justify-end"><Button type="submit" size="lg" loading={busy}>{farm ? "Save changes" : "Create farm"}</Button></div>
        </form>
      </Modal>
    </>
  );
}
