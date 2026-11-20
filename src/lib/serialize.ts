import { Prisma } from "@prisma/client";

type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/** Deep-convert Prisma Decimal -> number and Date -> ISO string so data can cross the server/client boundary as JSON. */
export function serialize<T>(value: T): Serialized<T> {
  return walk(value) as Serialized<T>;
}

function walk(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.toISOString();
  if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toNumber();
  if (Array.isArray(v)) return v.map(walk);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
    return out;
  }
  return v;
}

export const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));
export const numOrNull = (v: Prisma.Decimal | number | null | undefined): number | null => (v == null ? null : Number(v));
