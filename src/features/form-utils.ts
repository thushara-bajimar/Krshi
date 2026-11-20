import { todayISO } from "@/lib/format";
import type { Values } from "@/components/forms/record-form";

/** Convert a serialized record into form values (numbers -> strings, ISO dates -> YYYY-MM-DD, null -> ""). */
export function toValues(rec: Record<string, unknown> | undefined, dateKeys: string[] = []): Values {
  if (!rec) return {};
  const out: Values = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v == null) out[k] = "";
    else if (dateKeys.includes(k) && typeof v === "string") out[k] = v.slice(0, 10);
    else if (typeof v === "number") out[k] = String(v);
    else out[k] = v;
  }
  return out;
}
export const today = () => todayISO();
export const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));
