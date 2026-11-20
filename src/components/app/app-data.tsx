"use client";
import { createContext, useContext, useEffect } from "react";
import { translate, type DictKey, type Lang } from "@/lib/i18n/dict";
import { cachePut } from "@/offline/idb";

export interface AppData {
  user: { id: string; name: string; email: string; language: Lang; district: string | null; areaUnit: string };
  farm: { id: string; name: string; district: string; areaUnit: string; latitude: number | null; longitude: number | null } | null;
  farms: { id: string; name: string; role: string }[];
  role: string | null;
  perms: { write: boolean; financeRead: boolean; financeWrite: boolean; manage: boolean };
  plots: { id: string; name: string; cropId: string | null; cropName: string | null; area: number; areaUnit: string; plantCount: number | null; status: string }[];
  crops: { id: string; key: string; name: string; nameKn: string | null }[];
  workers: { id: string; name: string; category: string; defaultWage: number | null; wageType: string; active: boolean }[];
  inventory: { id: string; name: string; unit: string; quantity: number; category: string }[];
  renderedAt: string;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  useEffect(() => {
    // keep a copy for offline use (forms still work when the page is served from the offline cache)
    cachePut("appData", value).catch(() => {});
  }, [value]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppData outside provider");
  return c;
}

export function useT() {
  const lang = useContext(Ctx)?.user.language ?? "en";
  return { lang, t: (k: DictKey) => translate(lang, k) };
}
