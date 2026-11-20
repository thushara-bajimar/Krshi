"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type FilterDef =
  | { name: string; type: "search"; placeholder?: string }
  | { name: string; type: "select"; label: string; options: { value: string; label: string }[] }
  | { name: string; type: "date"; label: string };

/** Filters stored in the URL so they survive refreshes and can be bookmarked / shared. */
export function UrlFilters({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const apply = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete("page");
    start(() => router.replace(`${path}?${n.toString()}`, { scroll: false }));
  };
  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q) apply("q", q); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const active = filters.some((f) => sp.get(f.name));

  return (
    <div className={`mb-4 flex flex-wrap items-end gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
      {filters.map((f) =>
        f.type === "search" ? (
          <div key={f.name} className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={f.placeholder ?? "Search"} className="pl-9" aria-label="Search" />
          </div>
        ) : f.type === "select" ? (
          <Select key={f.name} value={sp.get(f.name) ?? ""} onChange={(e) => apply(f.name, e.target.value)} aria-label={f.label} className="w-auto min-w-[140px] flex-1 sm:flex-none">
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        ) : (
          <label key={f.name} className="flex flex-1 flex-col text-xs text-muted sm:flex-none">
            {f.label}
            <Input type="date" value={sp.get(f.name) ?? ""} onChange={(e) => apply(f.name, e.target.value)} className="mt-1 h-10 sm:w-40" />
          </label>
        ),
      )}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); start(() => router.replace(path, { scroll: false })); }}><X className="h-4 w-4" />Clear</Button>
      )}
    </div>
  );
}
