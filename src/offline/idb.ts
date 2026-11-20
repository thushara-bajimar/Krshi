"use client";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface QueuedMutation {
  mutationId: string;
  entity: string;
  op: "create" | "update" | "delete";
  id?: string;
  data?: unknown;
  baseVersion?: number;
  label: string; // human-readable summary, e.g. "Expense ₹500 — transport"
  farmId?: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: "pending" | "conflict" | "failed";
  lastError?: string;
  server?: unknown; // server copy when status = conflict
}

interface KrishiDB extends DBSchema {
  queue: { key: string; value: QueuedMutation; indexes: { byCreated: number } };
  cache: { key: string; value: { key: string; savedAt: number; data: unknown } };
}

let dbp: Promise<IDBPDatabase<KrishiDB>> | null = null;
export function db() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
  dbp ??= openDB<KrishiDB>("krishi", 1, {
    upgrade(d) {
      const q = d.createObjectStore("queue", { keyPath: "mutationId" });
      q.createIndex("byCreated", "createdAt");
      d.createObjectStore("cache", { keyPath: "key" });
    },
  });
  return dbp;
}

export const QUEUE_EVENT = "krishi:queue-changed";
const emit = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function enqueue(m: QueuedMutation) {
  await (await db()).put("queue", m);
  emit();
}
export async function updateQueued(m: QueuedMutation) {
  await (await db()).put("queue", m);
  emit();
}
export async function removeQueued(id: string) {
  await (await db()).delete("queue", id);
  emit();
}
export async function listQueue(): Promise<QueuedMutation[]> {
  return (await db()).getAllFromIndex("queue", "byCreated");
}

export async function cachePut(key: string, data: unknown) {
  await (await db()).put("cache", { key, data, savedAt: Date.now() });
}
export async function cacheGet<T>(key: string): Promise<{ data: T; savedAt: number } | null> {
  const r = await (await db()).get("cache", key);
  return r ? { data: r.data as T, savedAt: r.savedAt } : null;
}
