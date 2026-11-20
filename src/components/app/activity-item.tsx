import Link from "next/link";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, ACTIVITY_LABEL_KN } from "@/lib/constants";
import { date, money, number } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ActivityIcon } from "./activity-icon";

export interface ActivityLite {
  id: string; type: string; date: string | Date; productName: string | null; quantity: unknown; quantityUnit: string | null; cost: unknown; description: string | null;
  plot?: { name: string } | null; crop?: { name: string } | null;
}

export function ActivityRow({ a, lang = "en", showMoney = true }: { a: ActivityLite; lang?: string; showMoney?: boolean }) {
  return (
    <Link href={`/app/diary/${a.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sand/60 sm:px-5">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ACTIVITY_COLOR[a.type])}><ActivityIcon type={a.type} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{lang === "kn" ? ACTIVITY_LABEL_KN[a.type] : ACTIVITY_LABEL[a.type]}{a.productName ? ` — ${a.productName}` : ""}</p>
        <p className="truncate text-xs text-muted">
          {[a.plot?.name ?? a.crop?.name, a.quantity != null ? `${number(Number(a.quantity))} ${a.quantityUnit ?? ""}` : null, a.description && !a.productName ? a.description : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted">{date(a.date, { day: "numeric", month: "short" })}</p>
        {showMoney && a.cost != null && <p className="text-sm font-medium tabular">{money(Number(a.cost))}</p>}
      </div>
    </Link>
  );
}
