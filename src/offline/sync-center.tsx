"use client";
import { CloudOff, RefreshCw, Trash2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { ConfirmButton } from "@/components/ui/confirm";
import { useAppData } from "@/components/app/app-data";
import { dateTime } from "@/lib/format";
import { useSync } from "./sync-provider";

const FIELDS_HIDDEN = new Set(["id", "farmId", "createdAt", "updatedAt", "deletedAt", "createdById", "version"]);
function Diff({ mine, server }: { mine: Record<string, unknown>; server: Record<string, unknown> | null }) {
  if (!server) return <p className="text-sm">The record was <b>deleted</b> on another device.</p>;
  const norm = (v: unknown) => (v == null ? "" : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10) : String(v));
  const keys = Object.keys(mine).filter((k) => !FIELDS_HIDDEN.has(k) && norm(mine[k]) !== "" && norm(mine[k]) !== norm(server[k]));
  if (!keys.length) return <p className="text-sm text-muted">No visible field differences.</p>;
  return (
    <table className="w-full text-xs"><thead><tr className="text-left text-muted"><th className="py-1">Field</th><th>Your version</th><th>Saved on server</th></tr></thead>
      <tbody>{keys.map((k) => <tr key={k} className="border-t border-line"><td className="py-1 pr-2 font-medium">{k}</td><td className="pr-2">{String(mine[k])}</td><td>{String(server[k] ?? "—")}</td></tr>)}</tbody></table>
  );
}

export function SyncCenter() {
  const { online, queue, syncing, flush, resolveConflict, discard } = useSync();
  const app = useAppData();
  const pending = queue.filter((q) => q.status === "pending");
  const conflicts = queue.filter((q) => q.status === "conflict");
  const failed = queue.filter((q) => q.status === "failed");
  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {online ? <Wifi className="h-6 w-6 text-leaf-700" /> : <CloudOff className="h-6 w-6 text-amber-700" />}
            <div><p className="font-medium">{online ? "Online" : "Offline"}</p><p className="text-sm text-muted">{pending.length} waiting · {conflicts.length} conflicts · {failed.length} failed · page data from {dateTime(app.renderedAt)}</p></div>
          </div>
          <Button onClick={() => flush()} disabled={!online || !pending.length} loading={syncing}><RefreshCw className="h-4 w-4" />Sync now</Button>
        </CardBody>
      </Card>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader title="Conflicts — choose which version to keep" subtitle="Someone changed these records on another device before your offline edit reached the server. Nothing is overwritten until you choose." />
          <ul className="divide-y divide-line">{conflicts.map((m) => (
            <li key={m.mutationId} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{m.label}</p><span className="text-xs text-muted">edited offline {dateTime(new Date(m.createdAt))}</span></div>
              <Diff mine={(m.data ?? {}) as Record<string, unknown>} server={(m.server ?? null) as Record<string, unknown> | null} />
              <div className="flex flex-wrap gap-2">
                {m.server !== null && <Button size="sm" onClick={() => resolveConflict(m, "mine")}>Keep my version</Button>}
                <Button size="sm" variant="outline" onClick={() => resolveConflict(m, "theirs")}>Keep the server version</Button>
              </div>
            </li>
          ))}</ul>
        </Card>
      )}

      {failed.length > 0 && (
        <Card>
          <CardHeader title="Could not be saved" subtitle="The server rejected these entries. Re-enter them with the correct details, then discard." />
          <ul className="divide-y divide-line">{failed.map((m) => (
            <li key={m.mutationId} className="flex items-start justify-between gap-3 px-5 py-3">
              <div><p className="text-sm font-medium">{m.label}</p><p className="text-sm text-clay-700">{m.lastError}</p></div>
              <ConfirmButton title="Discard this entry?" body="It will be removed from this device." confirmLabel="Discard" trigger={(o) => <Button variant="ghost" size="icon" onClick={o} aria-label="Discard"><Trash2 className="h-4 w-4" /></Button>} onConfirm={() => discard(m)} />
            </li>
          ))}</ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Waiting to sync" />
        {pending.length === 0 ? <EmptyState title="Everything is synced" body="Entries made while offline will appear here until they reach the server." /> : (
          <ul className="divide-y divide-line">{pending.map((m) => (
            <li key={m.mutationId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div><p className="font-medium">{m.label}</p><p className="text-xs text-muted">Saved {dateTime(new Date(m.createdAt))}{m.attempts ? ` · ${m.attempts} attempt${m.attempts > 1 ? "s" : ""}, next try ${dateTime(new Date(m.nextAttemptAt))}` : ""}</p></div>
              <Badge tone="blue">{m.op}</Badge>
            </li>
          ))}</ul>
        )}
      </Card>

      <Notice title="How offline works">
        <ul className="list-disc space-y-1 pl-5">
          <li>Pages you have opened are kept on this phone and shown when you are offline, with the time they were saved.</li>
          <li>Diary activities, expenses, labour and payments, harvests, sales, tasks and stock movements can be added offline. Each gets a permanent id on this device, so syncing twice never creates duplicates.</li>
          <li>Edits carry the version you started from. If the record changed elsewhere meanwhile, KRSHI asks you which version to keep instead of overwriting.</li>
          <li>Market prices, weather, schemes, photos, the AI assistant, creating farms and sharing need internet.</li>
        </ul>
      </Notice>
    </div>
  );
}
