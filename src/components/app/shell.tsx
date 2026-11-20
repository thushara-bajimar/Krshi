"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { Bell, BookOpenText, ChevronDown, CloudOff, Home, LogOut, Menu, Plus, RefreshCw, Wallet, X, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";
import { NAV_GROUPS } from "./nav";
import { useAppData, useT } from "./app-data";
import { useSync } from "@/offline/sync-provider";
import { listQueue } from "@/offline/idb";
import { QuickActions, QuickLauncher, type QuickKind } from "./quick-actions";
import { dateTime } from "@/lib/format";

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/app" ? path === "/app" : path === href || path.startsWith(href + "/"));
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  const app = useAppData();
  const active = useActive();
  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.key}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{t(g.key)}</p>
          <ul className="space-y-0.5">
            {g.items.filter((i) => !i.finance || app.perms.financeRead).map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors",
                    active(i.href) ? "bg-leaf-800 font-medium text-white" : "text-ink/80 hover:bg-sand hover:text-ink",
                  )}
                >
                  <i.icon className="h-[18px] w-[18px] shrink-0" />
                  {t(i.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function FarmSwitcher() {
  const app = useAppData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!app.farm) return <Link href="/app/farms" className="text-sm font-medium text-leaf-700">Add a farm</Link>;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex max-w-[52vw] items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-sand sm:max-w-xs" aria-haspopup="listbox" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{app.farm.name}</span>
          <span className="block truncate text-[11px] text-muted">{app.farm.district}{app.role !== "OWNER" ? ` · ${app.role?.toLowerCase().replace("_", " ")}` : ""}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul role="listbox" className="absolute left-0 z-40 mt-1 w-64 rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-pop)]">
            {app.farms.map((f) => (
              <li key={f.id}>
                <button
                  role="option"
                  aria-selected={f.id === app.farm?.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sand"
                  onClick={async () => {
                    setOpen(false);
                    if (f.id === app.farm?.id) return;
                    const r = await fetch("/api/farms/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmId: f.id }) });
                    if (r.ok) router.refresh();
                    else toast.error("Could not switch farm");
                  }}
                >
                  <span className="truncate">{f.name}</span>
                  {f.id === app.farm?.id && <Check className="h-4 w-4 text-leaf-700" />}
                </button>
              </li>
            ))}
            <li className="border-t border-line mt-1 pt-1">
              <Link href="/app/farms" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-leaf-700 hover:bg-sand">Manage farms</Link>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

function SyncBadge() {
  const { online, queue, syncing, flush } = useSync();
  const pending = queue.filter((q) => q.status === "pending").length;
  const problems = queue.filter((q) => q.status !== "pending").length;
  const { t } = useT();
  if (online && !pending && !problems) return null;
  return (
    <Link
      href="/app/sync"
      onClick={() => online && flush()}
      className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", !online ? "bg-amber-100 text-amber-900" : problems ? "bg-clay-50 text-clay-700" : "bg-sky-100 text-sky-900")}
    >
      {!online ? <CloudOff className="h-3.5 w-3.5" /> : problems ? <AlertTriangle className="h-3.5 w-3.5" /> : <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />}
      <span className="hidden sm:inline">{!online ? t("common.offline") : ""}</span>
      {pending > 0 && <span>{pending} {t("common.pendingSync")}</span>}
      {problems > 0 && <span>{problems} need attention</span>}
    </Link>
  );
}

function OfflineBanner() {
  const { online } = useSync();
  const app = useAppData();
  if (online) return null;
  return (
    <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
      You are offline. Showing information saved at <b>{dateTime(app.renderedAt)}</b>. New diary, expense, labour, harvest and task entries will be saved on this device and synced later. Prices, weather and schemes need internet.
    </div>
  );
}

export function AppShell({ children, unread }: { children: React.ReactNode; unread: number }) {
  const app = useAppData();
  const { t } = useT();
  const active = useActive();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [add, setAdd] = useState(false);
  const [quick, setQuick] = useState<{ kind: QuickKind; n: number } | null>(null);
  const sync = useSync();

  async function signOut() {
    // never silently drop entries captured offline
    await sync.flush();
    const unsynced = (await listQueue().catch(() => [])).length;
    if (unsynced > 0 && !window.confirm(`${unsynced} entr${unsynced === 1 ? "y has" : "ies have"} not reached the server yet and will be lost if you sign out. Sign out anyway?`)) return;
    await fetch("/api/auth/logout", { method: "POST" });
    // remove offline copies of this user's pages and queued data from the device
    navigator.serviceWorker?.controller?.postMessage("clear-caches");
    try { indexedDB.deleteDatabase("krishi"); } catch { /* ignore */ }
    router.push("/login");
    router.refresh();
  }

  const bottom = [
    { href: "/app", label: t("nav.home"), icon: Home },
    { href: "/app/diary", label: t("nav.diary"), icon: BookOpenText },
    null,
    { href: app.perms.financeRead ? "/app/finance" : "/app/calendar", label: app.perms.financeRead ? t("nav.money") : t("nav.calendar"), icon: Wallet },
  ];

  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex h-16 items-center px-5"><Link href="/app"><Logo /></Link></div>
        <div className="flex-1 overflow-y-auto px-3 pb-6"><NavList /></div>
        <div className="border-t border-line p-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{app.user.name}</p>
              <p className="truncate text-xs text-muted">{app.user.email}</p>
            </div>
            <button onClick={signOut} className="rounded-md p-2 text-muted hover:bg-sand hover:text-ink" aria-label={t("common.signOut")} title={t("common.signOut")}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          <button className="rounded-md p-2 hover:bg-sand lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <FarmSwitcher />
          <div className="ml-auto flex items-center gap-1.5">
            <SyncBadge />
            <Link href="/app/notifications" className="relative rounded-md p-2 hover:bg-sand" aria-label={`${t("nav.notifications")}${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-600 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          </div>
        </div>
        <OfflineBanner />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 print:max-w-none print:p-0">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main">
        <ul className="grid grid-cols-5">
          {bottom.map((b, i) =>
            b === null ? (
              <li key="add" className="flex items-center justify-center">
                <button onClick={() => setAdd(true)} className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-leaf-800 text-white shadow-lg ring-4 ring-cream" aria-label={t("nav.add")} disabled={!app.farm || !app.perms.write}>
                  <Plus className="h-7 w-7" />
                </button>
              </li>
            ) : (
              <li key={b.href}>
                <Link href={b.href} className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-[11px]", active(b.href) ? "font-semibold text-leaf-800" : "text-muted")}>
                  <b.icon className="h-5 w-5" />
                  <span className="max-w-full truncate px-1">{b.label}</span>
                </Link>
              </li>
            ),
          )}
          <li>
            <button onClick={() => setMenu(true)} className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted">
              <Menu className="h-5 w-5" />
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile drawer */}
      <D.Root open={menu} onOpenChange={setMenu}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-xs flex-col bg-white shadow-xl focus:outline-none">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <D.Title asChild><span><Logo /></span></D.Title>
              <D.Description className="sr-only">Navigation menu</D.Description>
              <D.Close className="rounded-md p-2 hover:bg-sand" aria-label="Close menu"><X className="h-5 w-5" /></D.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4"><NavList onNavigate={() => setMenu(false)} /></div>
            <div className="border-t border-line p-3">
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-sand"><LogOut className="h-4 w-4" />{t("common.signOut")}</button>
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>

      <QuickLauncher req={quick} />

      {/* Mobile quick-add sheet */}
      <D.Root open={add} onOpenChange={setAdd}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <D.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-cream p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] focus:outline-none">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <D.Title className="mb-3 text-base font-semibold">{t("nav.add")}</D.Title>
            <D.Description className="sr-only">Quick actions</D.Description>
            <QuickActions withInfo={false} onPick={(kind) => { setAdd(false); setQuick((q) => ({ kind, n: (q?.n ?? 0) + 1 })); }} />
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}
