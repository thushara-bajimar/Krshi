"use client";
import Link from "next/link";
import { CloudUpload } from "lucide-react";
import { useSync } from "./sync-provider";

/** Shows entries captured offline that have not reached the server yet. */
export function PendingQueueList({ entity }: { entity?: string }) {
  const { queue } = useSync();
  const items = queue.filter((q) => !entity || q.entity === entity);
  if (!items.length) return null;
  return (
    <Link href="/app/sync" className="mb-4 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
      <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <b>{items.length} saved on this device</b>, waiting to sync: {items.slice(0, 3).map((i) => i.label).join("; ")}{items.length > 3 ? "…" : ""}
      </span>
    </Link>
  );
}
