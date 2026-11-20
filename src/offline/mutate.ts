"use client";
import { enqueue, type QueuedMutation } from "./idb";

export type SubmitResult =
  | { status: "saved"; body: { record?: Record<string, unknown> & { id: string }; [k: string]: unknown } }
  | { status: "queued" }
  | { status: "conflict"; error: string; server: unknown; kind: "version" | "deleted" }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

// Entities that may be created/edited while offline (queued & replayed). Others require a connection.
export const OFFLINE_ENTITIES = new Set(["activity", "expense", "labor", "laborPayment", "inventoryTxn", "task", "harvest", "income"]);

export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16));

export interface MutationInput {
  entity: string;
  op: "create" | "update" | "delete";
  id?: string;
  data?: Record<string, unknown>;
  baseVersion?: number;
  label: string;
  farmId?: string;
}

/** Sends one mutation to the server. Network failures throw TypeError (fetch) — callers decide whether to queue. */
export async function sendMutation(m: Pick<QueuedMutation, "mutationId" | "entity" | "op" | "id" | "data" | "baseVersion">): Promise<SubmitResult> {
  const url = m.op === "create" ? `/api/records/${m.entity}` : `/api/records/${m.entity}/${m.id}`;
  const method = m.op === "create" ? "POST" : m.op === "update" ? "PATCH" : "DELETE";
  const body = m.op === "create" ? JSON.stringify(m.data) : m.op === "update" ? JSON.stringify({ data: m.data, baseVersion: m.baseVersion }) : undefined;
  const res = await fetch(url, { method, body, headers: { "Content-Type": "application/json", "X-Mutation-Id": m.mutationId }, credentials: "same-origin" });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  if (res.ok) return { status: "saved", body: json as SubmitResult extends { body: infer B } ? B : never };
  if (res.status === 409 && json.conflict) return { status: "conflict", error: String(json.error), server: json.server, kind: json.conflict as "version" | "deleted" };
  if (res.status === 401) return { status: "error", error: "Your session has expired. Please sign in again." };
  return { status: "error", error: String(json.error ?? `Request failed (${res.status})`), fieldErrors: json.fieldErrors as Record<string, string[]> | undefined };
}

/**
 * Submit a record change. Online: sent immediately. Offline (or connection drops): queued in IndexedDB for
 * entities that support offline capture, and replayed by the sync manager. Creates get a stable client id
 * so a replay can never create a duplicate.
 */
export async function submitRecord(input: MutationInput): Promise<SubmitResult> {
  const data = input.op === "create" ? { id: uuid(), ...input.data } : input.data;
  const m = { mutationId: uuid(), entity: input.entity, op: input.op, id: input.id, data, baseVersion: input.baseVersion };
  const canQueue = OFFLINE_ENTITIES.has(input.entity);
  const queue = async () => {
    await enqueue({ ...m, label: input.label, farmId: input.farmId, createdAt: Date.now(), attempts: 0, nextAttemptAt: Date.now(), status: "pending" });
    return { status: "queued" } as const;
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (canQueue) return queue();
    return { status: "error", error: "You are offline. This needs an internet connection." };
  }
  try {
    return await sendMutation(m);
  } catch {
    if (canQueue) return queue();
    return { status: "error", error: "Could not reach the server. Check your connection and try again." };
  }
}
