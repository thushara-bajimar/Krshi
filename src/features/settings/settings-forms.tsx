"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { ConfirmButton } from "@/components/ui/confirm";
import { Notice } from "@/components/ui/misc";
import { AREA_UNIT_LABEL, DISTRICTS, DISTRICT_NAMES } from "@/lib/constants";
import { passwordChangeSchema, profileSchema } from "@/lib/validation/schemas";

type Profile = { name: string; phone: string | null; language: string; district: string | null; taluk: string | null; village: string | null; areaUnit: string };
type Settings = { notifyTasks: boolean; notifyInventory: boolean; notifyPayments: boolean; notifyWeather: boolean; notifyPriceAlerts: boolean; taskReminderDays: number; voiceLanguage: string };

async function patch(body: object) {
  const r = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [v, setV] = useState({ ...profile, phone: profile.phone ?? "", district: profile.district ?? "", taluk: profile.taluk ?? "", village: profile.village ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = profileSchema.safeParse(v);
    if (!p.success) return setErrors(Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setBusy(true);
    const { ok, j } = await patch({ profile: p.data });
    setBusy(false);
    if (!ok) return void toast.error(j.error ?? "Could not save");
    toast.success("Profile saved");
    router.refresh();
  }
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="p-name" error={errors.name}><Input id="p-name" value={v.name} onChange={set("name")} /></Field>
      <Field label="Phone" htmlFor="p-phone" optional error={errors.phone}><Input id="p-phone" type="tel" value={v.phone} onChange={set("phone")} /></Field>
      <Field label="Language / ಭಾಷೆ" htmlFor="p-lang"><Select id="p-lang" value={v.language} onChange={set("language")}><option value="en">English</option><option value="kn">ಕನ್ನಡ (Kannada)</option></Select></Field>
      <Field label="Preferred area unit" htmlFor="p-unit"><Select id="p-unit" value={v.areaUnit} onChange={set("areaUnit")}>{Object.entries(AREA_UNIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="District" htmlFor="p-d" optional><Select id="p-d" value={v.district} onChange={(e) => setV({ ...v, district: e.target.value, taluk: "" })}><option value="">—</option>{DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
      <Field label="Taluk" htmlFor="p-t" optional><Select id="p-t" value={v.taluk} onChange={set("taluk")}><option value="">—</option>{(DISTRICTS[v.district] ?? []).map((t) => <option key={t}>{t}</option>)}</Select></Field>
      <Field label="Village" htmlFor="p-v" optional><Input id="p-v" value={v.village} onChange={set("village")} /></Field>
      <div className="flex items-end justify-end sm:col-span-2"><Button type="submit" loading={busy}>Save profile</Button></div>
    </form>
  );
}

export function PreferencesForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [v, setV] = useState(settings);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { ok } = await patch({ settings: v });
    setBusy(false);
    if (ok) { toast.success("Preferences saved"); router.refresh(); } else toast.error("Could not save");
  }
  const toggle = (k: keyof Settings, label: string, hint?: string) => <Checkbox label={label} hint={hint} checked={v[k] as boolean} onChange={(c) => setV({ ...v, [k]: c })} />;
  return (
    <div className="space-y-3">
      {toggle("notifyTasks", "Task reminders", "Planned work, overdue tasks and diary follow-ups")}
      {toggle("notifyInventory", "Inventory alerts", "Low stock and expiry")}
      {toggle("notifyPayments", "Pending wage reminders", "Work unpaid for more than 7 days")}
      {toggle("notifyWeather", "Weather warnings", "Heavy rain (IMD categories) and strong wind at your farms")}
      {toggle("notifyPriceAlerts", "Price alerts", "When a reported price crosses your alert level")}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Default reminder (days before a task)" htmlFor="s-rd"><Input id="s-rd" type="number" min={0} max={14} value={v.taskReminderDays} onChange={(e) => setV({ ...v, taskReminderDays: Number(e.target.value) })} /></Field>
        <Field label="Voice assistant language" htmlFor="s-vl"><Select id="s-vl" value={v.voiceLanguage} onChange={(e) => setV({ ...v, voiceLanguage: e.target.value })}><option value="en-IN">English (India)</option><option value="kn-IN">ಕನ್ನಡ</option></Select></Field>
      </div>
      <div className="flex justify-end"><Button onClick={save} loading={busy}>Save preferences</Button></div>
    </div>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordChangeSchema.safeParse(v);
    if (!p.success) return setErr(p.error.issues[0].message);
    setErr(null);
    setBusy(true);
    const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "Could not change password");
    toast.success("Password changed. Other devices have been signed out.");
    setV({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
      <Field label="Current password" htmlFor="pw-c"><Input id="pw-c" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} /></Field>
      <Field label="New password" htmlFor="pw-n"><Input id="pw-n" type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} /></Field>
      <Field label="Confirm new password" htmlFor="pw-r"><Input id="pw-r" type="password" autoComplete="new-password" value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} /></Field>
      {err && <Notice tone="danger" className="sm:col-span-3">{err}</Notice>}
      <div className="flex justify-end sm:col-span-3"><Button type="submit" loading={busy}>Change password</Button></div>
    </form>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  return (
    <ConfirmButton
      title="Delete your account?"
      body={<>This permanently deletes your account and every farm you <b>own</b>, with all their records. Farms shared with you by others are not affected. Download reports first if you need them.</>}
      confirmLabel="Delete my account"
      trigger={(o) => <Button variant="outline" className="text-clay-600" onClick={o}>Delete account</Button>}
      onConfirm={async () => {
        const r = await fetch("/api/me", { method: "DELETE" });
        if (!r.ok) return void toast.error("Could not delete account");
        router.push("/");
      }}
    />
  );
}
