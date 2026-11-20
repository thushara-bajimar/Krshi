"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/misc";
import { PlotFormDialog } from "@/features/farm-forms";
import { FarmFormDialog } from "./farm-form";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/constants";

export function AddFarmButton({ welcome }: { welcome?: boolean }) {
  return <FarmFormDialog defaultOpen={welcome} trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add farm</Button>} />;
}

export function EditFarmButton({ farm }: { farm: Parameters<typeof FarmFormDialog>[0]["farm"] }) {
  return <FarmFormDialog farm={farm} trigger={(o) => <Button variant="outline" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>} />;
}

export function AddPlotButton() {
  return <PlotFormDialog trigger={(o) => <Button onClick={o}><Plus className="h-4 w-4" />Add plot</Button>} />;
}

export function EditPlotButton({ plot }: { plot: Record<string, unknown> & { id: string } }) {
  return <PlotFormDialog record={plot} trigger={(o) => <Button variant="outline" size="sm" onClick={o}><Pencil className="h-4 w-4" />Edit</Button>} />;
}

export function DeleteFarmButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      title={`Delete ${name}?`}
      body={<>This permanently deletes the farm and <b>all</b> its plots, diary entries, labour, expenses, sales, inventory and tasks. Download a report first if you need a copy.</>}
      confirmLabel="Delete farm"
      trigger={(o) => <Button variant="outline" onClick={o} className="text-clay-600"><Trash2 className="h-4 w-4" />Delete farm</Button>}
      onConfirm={async () => {
        const r = await fetch(`/api/farms/${id}`, { method: "DELETE" });
        if (!r.ok) return void toast.error((await r.json().catch(() => ({}))).error ?? "Could not delete");
        toast.success("Farm deleted");
        router.push("/app/farms");
        router.refresh();
      }}
    />
  );
}

type Member = { id: string; role: string; user: { id: string; name: string; email: string } };

export function MembersPanel({ farmId, members, canManage, selfId }: { farmId: string; members: Member[]; canManage: boolean; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/farms/${farmId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.fieldErrors?.email?.[0] ?? j.error ?? "Could not share");
    toast.success("Access granted");
    setEmail("");
    router.refresh();
  }
  async function changeRole(membershipId: string, newRole: string) {
    const r = await fetch(`/api/farms/${farmId}/members`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ membershipId, role: newRole }) });
    if (r.ok) { toast.success("Role updated"); router.refresh(); } else toast.error("Could not update role");
  }
  async function remove(membershipId: string, self: boolean) {
    const r = await fetch(`/api/farms/${farmId}/members?membershipId=${membershipId}`, { method: "DELETE" });
    if (!r.ok) return void toast.error((await r.json().catch(() => ({}))).error ?? "Could not remove");
    toast.success(self ? "You left this farm" : "Access removed");
    if (self) router.push("/app/farms");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.user.name}{m.user.id === selfId && <span className="text-muted"> (you)</span>}</p>
              <p className="truncate text-xs text-muted">{m.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && m.role !== "OWNER" ? (
                <Select className="h-9 w-40 text-sm" value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} aria-label={`Role for ${m.user.name}`}>
                  {["MANAGER", "FINANCE_VIEWER", "VIEWER"].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              ) : (
                <Badge tone={m.role === "OWNER" ? "green" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
              )}
              {m.role !== "OWNER" && (canManage || m.user.id === selfId) && (
                <ConfirmButton
                  title={m.user.id === selfId ? "Leave this farm?" : `Remove ${m.user.name}?`}
                  body={m.user.id === selfId ? "You will no longer see this farm." : "They will immediately lose access to this farm."}
                  confirmLabel={m.user.id === selfId ? "Leave" : "Remove"}
                  trigger={(o) => <Button variant="ghost" size="icon" onClick={o} aria-label="Remove access"><X className="h-4 w-4" /></Button>}
                  onConfirm={() => remove(m.id, m.user.id === selfId)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      {canManage && (
        <form onSubmit={invite} className="space-y-3 rounded-lg bg-sand/50 p-3">
          <p className="text-sm font-medium">Share this farm</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label="Their KRSHI account email" htmlFor="inv-email"><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="family.member@example.com" /></Field>
            <Field label="Access" htmlFor="inv-role">
              <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {["MANAGER", "FINANCE_VIEWER", "VIEWER"].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted">{ROLE_HELP[role]}</p>
          {err && <Notice tone="danger">{err}</Notice>}
          <Button type="submit" size="sm" loading={busy} disabled={!email}><UserPlus className="h-4 w-4" />Give access</Button>
        </form>
      )}
    </div>
  );
}
