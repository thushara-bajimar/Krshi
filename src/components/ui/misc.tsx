import { cn } from "@/lib/cn";
import { Inbox } from "lucide-react";

const badgeTones = {
  neutral: "bg-sand text-ink/80",
  green: "bg-leaf-100 text-leaf-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-clay-50 text-clay-700",
  blue: "bg-sky-100 text-sky-900",
  brown: "bg-earth-100 text-earth-800",
} as const;

export function Badge({ tone = "neutral", className, children }: { tone?: keyof typeof badgeTones; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", badgeTones[tone], className)}>{children}</span>;
}

export function EmptyState({ icon, title, body, action, className }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-leaf-50 text-leaf-700">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger" | "success"; title?: string; children: React.ReactNode; className?: string }) {
  const t = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-clay-600/30 bg-clay-50 text-clay-700",
    success: "border-leaf-200 bg-leaf-50 text-leaf-900",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", t, className)} role={tone === "danger" ? "alert" : undefined}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/** Shows where a piece of information came from. Required for all external / sample data. */
export function Provenance({ kind, source, sourceUrl, at, className }: { kind: "LIVE" | "CACHED" | "SAMPLE" | "USER" | "CURATED"; source?: string; sourceUrl?: string; at?: string | null; className?: string }) {
  const tone = { LIVE: "green", CACHED: "amber", SAMPLE: "red", USER: "blue", CURATED: "brown" } as const;
  const label = { LIVE: "Live", CACHED: "Cached", SAMPLE: "Sample data", USER: "Your record", CURATED: "Curated" }[kind];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted", className)}>
      <Badge tone={tone[kind]}>{label}</Badge>
      {source && (sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{source}</a> : <span>{source}</span>)}
      {at && <span>· {at}</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-sand", className)} />;
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("mb-3 text-sm font-semibold uppercase tracking-wide text-muted", className)}>{children}</h2>;
}
