"use client";
import Link from "next/link";
import { useEffect } from "react";
import { BookOpenText, CalendarPlus, CloudSun, HandCoins, Landmark, BarChart3, ShoppingBasket, Users, Wheat } from "lucide-react";
import { ActivityFormDialog, HarvestFormDialog, TaskFormDialog } from "@/features/farm-forms";
import { ExpenseFormDialog, IncomeFormDialog, LaborFormDialog } from "@/features/money-forms";
import { useAppData, useT } from "./app-data";
import { cn } from "@/lib/cn";

function Tile({ icon: Icon, label, onClick, href, tone = "green" }: { icon: typeof Users; label: string; onClick?: () => void; href?: string; tone?: "green" | "earth" | "sky" }) {
  const toneCls = { green: "bg-leaf-50 text-leaf-800", earth: "bg-earth-50 text-earth-700", sky: "bg-sky-50 text-sky-800" }[tone];
  const cls = "group flex min-h-[84px] flex-col items-start justify-between gap-2 rounded-xl border border-line bg-white p-3 text-left transition-colors hover:border-leaf-300 hover:bg-leaf-50/40 active:scale-[0.99]";
  const inner = (
    <>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneCls)}><Icon className="h-5 w-5" /></span>
      <span className="text-sm font-medium leading-tight text-ink">{label}</span>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export type QuickKind = "activity" | "expense" | "labor" | "harvest" | "sale" | "task";

function AutoOpen({ open }: { open: () => void }) {
  // open once on mount; `open` is a new function each render, so it must not be a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { open(); }, []);
  return null;
}

/** Opens one quick-add form outside of any sheet (so closing the sheet does not unmount the form). */
export function QuickLauncher({ req }: { req: { kind: QuickKind; n: number } | null }) {
  if (!req) return null;
  const t = (o: () => void) => <AutoOpen open={o} />;
  const k = req.n;
  switch (req.kind) {
    case "activity": return <ActivityFormDialog key={k} trigger={t} />;
    case "expense": return <ExpenseFormDialog key={k} trigger={t} />;
    case "labor": return <LaborFormDialog key={k} trigger={t} />;
    case "harvest": return <HarvestFormDialog key={k} trigger={t} />;
    case "sale": return <IncomeFormDialog key={k} trigger={t} />;
    case "task": return <TaskFormDialog key={k} trigger={t} />;
  }
}

/** Big, thumb-friendly shortcuts used on the dashboard and in the mobile "+" sheet.
 *  With `onPick`, tiles only report which form to open (used inside the sheet). */
export function QuickActions({ withInfo = true, onPick }: { withInfo?: boolean; onPick?: (k: QuickKind) => void }) {
  const app = useAppData();
  const { t } = useT();
  if (!app.farm || !app.perms.write) return null;
  const tile = (kind: QuickKind, icon: typeof Users, label: string, tone: "green" | "earth", Dialog: (p: { trigger: (o: () => void) => React.ReactNode }) => React.ReactNode) =>
    onPick ? <Tile key={kind} icon={icon} label={label} tone={tone} onClick={() => onPick(kind)} /> : <Dialog key={kind} trigger={(o) => <Tile icon={icon} label={label} tone={tone} onClick={o} />} />;
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
      {tile("activity", BookOpenText, t("qa.activity"), "green", ActivityFormDialog)}
      {app.perms.financeWrite && tile("expense", HandCoins, t("qa.expense"), "earth", ExpenseFormDialog)}
      {app.perms.financeWrite && tile("labor", Users, t("qa.labor"), "earth", LaborFormDialog)}
      {tile("harvest", Wheat, t("qa.harvest"), "green", HarvestFormDialog)}
      {app.perms.financeWrite && tile("sale", ShoppingBasket, t("qa.sale"), "earth", IncomeFormDialog)}
      {tile("task", CalendarPlus, t("qa.task"), "green", TaskFormDialog)}
      {withInfo && (
        <>
          <Tile icon={BarChart3} label={t("qa.market")} href="/app/market" tone="sky" />
          <Tile icon={CloudSun} label={t("qa.weather")} href="/app/weather" tone="sky" />
          <Tile icon={Landmark} label={t("qa.schemes")} href="/app/schemes" tone="sky" />
        </>
      )}
    </div>
  );
}
