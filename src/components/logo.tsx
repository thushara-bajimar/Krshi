import { cn } from "@/lib/cn";

/** KRSHI mark: a sprout rising from three field furrows. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#1c3520" />
      <path d="M8 30.5c4-1.6 8-2.4 12-2.4s8 .8 12 2.4" stroke="#9fc497" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M11 34.5c3-1 6-1.5 9-1.5s6 .5 9 1.5" stroke="#6fa466" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
      <path d="M20 27V15.5" stroke="#e3eee0" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 18.5c0-4.6 3.4-7.6 8.6-7.6 0 4.8-3.6 7.6-8.6 7.6Z" fill="#9fc497" />
      <path d="M20 21.5c0-3.9-2.9-6.4-7.3-6.4 0 4 3 6.4 7.3 6.4Z" fill="#c7ddc1" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className={cn("text-lg font-bold tracking-[0.14em]", light ? "text-white" : "text-leaf-900")}>KRSHI</span>
    </span>
  );
}
