"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

type T = { status: string; collectedDocuments: string[]; applicationRef: string | null; notes: string | null; followUpDate: string | null } | null;
const STATUS = { INTERESTED: "Interested", COLLECTING_DOCUMENTS: "Collecting documents", APPLIED: "Applied", APPROVED: "Approved", REJECTED: "Rejected", NOT_ELIGIBLE: "Not eligible" };

export function SchemeTracker({ schemeId, documents, tracker }: { schemeId: string; documents: string[]; tracker: T }) {
  const router = useRouter();
  const [v, setV] = useState({ status: tracker?.status ?? "INTERESTED", docs: new Set(tracker?.collectedDocuments ?? []), applicationRef: tracker?.applicationRef ?? "", notes: tracker?.notes ?? "", followUpDate: tracker?.followUpDate?.slice(0, 10) ?? "" });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await fetch("/api/schemes/tracker", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schemeId, status: v.status, collectedDocuments: [...v.docs], applicationRef: v.applicationRef, notes: v.notes, followUpDate: v.followUpDate, bookmarked: true }) });
    setBusy(false);
    if (r.ok) { toast.success("Saved to your applications"); router.refresh(); } else toast.error("Could not save");
  }
  async function remove() {
    await fetch(`/api/schemes/tracker?schemeId=${schemeId}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div className="space-y-4">
      {!tracker && <p className="text-sm text-muted">Track this scheme to keep a document checklist, your application number and a follow-up reminder. This is your own record — KRSHI does not submit applications or know their official status.</p>}
      <div>
        <p className="mb-2 text-sm font-medium">Documents ({v.docs.size}/{documents.length} collected)</p>
        <ul className="space-y-1.5">
          {documents.map((d) => (
            <li key={d}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-leaf-700" checked={v.docs.has(d)} onChange={(e) => { const n = new Set(v.docs); if (e.target.checked) n.add(d); else n.delete(d); setV({ ...v, docs: n }); }} />
                <span className={v.docs.has(d) ? "text-muted line-through" : ""}>{d}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="My status" htmlFor="tr-s"><Select id="tr-s" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Follow up on" htmlFor="tr-f" optional><Input id="tr-f" type="date" value={v.followUpDate} onChange={(e) => setV({ ...v, followUpDate: e.target.value })} /></Field>
        <Field label="Application / reference number" htmlFor="tr-r" optional className="sm:col-span-2"><Input id="tr-r" value={v.applicationRef} onChange={(e) => setV({ ...v, applicationRef: e.target.value })} /></Field>
        <Field label="Notes" htmlFor="tr-n" optional className="sm:col-span-2"><Textarea id="tr-n" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Who you spoke to, what they said, next steps" /></Field>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} loading={busy}><Bookmark className="h-4 w-4" />{tracker ? "Save" : "Track this scheme"}</Button>
        {tracker && <Button variant="ghost" onClick={remove}>Stop tracking</Button>}
      </div>
    </div>
  );
}
