"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QUEUE_EVENT, listQueue, removeQueued, updateQueued, type QueuedMutation } from "./idb";
import { sendMutation } from "./mutate";

interface SyncState {
  online: boolean;
  queue: QueuedMutation[];
  syncing: boolean;
  flush: () => Promise<void>;
  resolveConflict: (m: QueuedMutation, choice: "mine" | "theirs") => Promise<void>;
  discard: (m: QueuedMutation) => Promise<void>;
}

const Ctx = createContext<SyncState | null>(null);
export const useSync = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSync outside SyncProvider");
  return c;
};

const backoff = (attempts: number) => Math.min(5 * 60_000, 2 ** attempts * 5_000);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    try {
      setQueue(await listQueue());
    } catch {
      /* IndexedDB unavailable (private mode) */
    }
  }, []);

  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    setSyncing(true);
    let synced = 0;
    try {
      const items = (await listQueue()).filter((q) => q.status === "pending" && q.nextAttemptAt <= Date.now());
      for (const m of items) {
        try {
          const r = await sendMutation(m);
          if (r.status === "saved") {
            await removeQueued(m.mutationId);
            synced++;
          } else if (r.status === "conflict") {
            await updateQueued({ ...m, status: "conflict", lastError: r.error, server: r.server });
            toast.warning(`Sync conflict: ${m.label}`, { description: "Open Offline & sync to choose which version to keep." });
          } else {
            await updateQueued({ ...m, status: "failed", lastError: r.status === "error" ? r.error : "Unexpected response", attempts: m.attempts + 1 });
            toast.error(`Could not sync: ${m.label}`, { description: r.status === "error" ? r.error : undefined });
          }
        } catch {
          // still unreachable — retry later with exponential backoff; keep order by stopping here
          await updateQueued({ ...m, attempts: m.attempts + 1, nextAttemptAt: Date.now() + backoff(m.attempts + 1), lastError: "Network unavailable" });
          break;
        }
      }
    } finally {
      busy.current = false;
      setSyncing(false);
      await reload();
      if (synced > 0) {
        toast.success(`${synced} offline ${synced === 1 ? "entry" : "entries"} synced`);
        router.refresh();
      }
    }
  }, [reload, router]);

  const resolveConflict = useCallback(
    async (m: QueuedMutation, choice: "mine" | "theirs") => {
      if (choice === "theirs") {
        await removeQueued(m.mutationId);
        toast.success("Kept the version saved on the server");
        router.refresh();
        return;
      }
      // keep mine: resend without the base version so it overwrites, with a fresh mutation id
      const next = { ...m, mutationId: crypto.randomUUID(), baseVersion: undefined, status: "pending" as const, nextAttemptAt: Date.now(), server: undefined };
      if (m.op === "update" && (m.server === null || m.server === undefined)) {
        toast.error("The record was deleted on another device, so your edit cannot be applied. Re-enter it as a new record if needed.");
        await removeQueued(m.mutationId);
        return;
      }
      await removeQueued(m.mutationId);
      await updateQueued(next);
      await flush();
    },
    [flush, router],
  );

  const discard = useCallback(async (m: QueuedMutation) => {
    await removeQueued(m.mutationId);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    reload();
    const on = () => {
      setOnline(true);
      flush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(QUEUE_EVENT, reload);
    const iv = setInterval(() => navigator.onLine && flush(), 30_000);
    flush();
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("SW registration failed", e));
      } else {
        // In development, remove any service worker left over from a production run on this origin —
        // its cache-first static rule would otherwise serve stale (unhashed) dev CSS/JS.
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
        if ("caches" in window) caches.keys().then((keys) => keys.filter((k) => k.startsWith("krishi-")).forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(QUEUE_EVENT, reload);
      clearInterval(iv);
    };
  }, [flush, reload]);

  return <Ctx.Provider value={{ online, queue, syncing, flush, resolveConflict, discard }}>{children}</Ctx.Provider>;
}
