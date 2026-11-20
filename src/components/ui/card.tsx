import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...p}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, href, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-leaf-700">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action ?? (href && (
        <Link href={href} className="inline-flex shrink-0 items-center text-sm font-medium text-leaf-700 hover:text-leaf-900">
          View <ChevronRight className="h-4 w-4" />
        </Link>
      ))}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function Stat({ label, value, sub, tone = "default", href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "good" | "bad" | "warn"; href?: string }) {
  const toneCls = { default: "text-ink", good: "text-leaf-700", bad: "text-clay-600", warn: "text-amber-700" }[tone];
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular sm:text-2xl", toneCls)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition-colors hover:border-leaf-300">{inner}</Link>
  ) : (
    <div className="card p-4">{inner}</div>
  );
}
