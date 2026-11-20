const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export const money = (v: number | string | null | undefined, whole = false) => (v == null || v === "" ? "—" : (whole ? inr0 : inr).format(Number(v)));
export const number = (v: number | string | null | undefined) => (v == null || v === "" ? "—" : numFmt.format(Number(v)));

/** Dates stored as calendar days (Postgres DATE) are UTC midnight: always format them in UTC. */
export function date(v: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(v));
}
export function dateTime(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(v));
}
export function relativeDays(v: string | Date) {
  const d = new Date(v);
  const today = new Date(todayISO() + "T00:00:00Z");
  const diff = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

/** Today's date in India as YYYY-MM-DD (independent of server timezone). */
export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}
export const isoDay = (v: string | Date) => new Date(v).toISOString().slice(0, 10);

export function titleCase(s: string | null | undefined) {
  if (!s) return "";
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function cropAge(plantingDate: string | Date | null | undefined): string | null {
  if (!plantingDate) return null;
  const p = new Date(plantingDate);
  const now = new Date();
  let months = (now.getFullYear() - p.getUTCFullYear()) * 12 + (now.getMonth() - p.getUTCMonth());
  if (now.getDate() < p.getUTCDate()) months--;
  if (months < 0) return null;
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} month${m === 1 ? "" : "s"}`;
  return `${y} yr${y === 1 ? "" : "s"}${m ? ` ${m} mo` : ""}`;
}
