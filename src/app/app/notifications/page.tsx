import Link from "next/link";
import type { Metadata } from "next";
import { Bell, CalendarDays, CloudRain, IndianRupee, Landmark, Package, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { pageContext } from "@/server/context";
import { generateNotifications } from "@/server/notifications";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { MarkAllRead, NotificationActions } from "@/features/settings/notification-actions";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notifications" };
const ICON = { TASK: CalendarDays, INVENTORY: Package, PAYMENT: IndianRupee, WEATHER: CloudRain, PRICE: TrendingUp, SCHEME: Landmark, SYSTEM: Bell } as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const ctx = await pageContext();
  await generateNotifications(ctx.user.id, true).catch((e) => console.warn("[notifications]", e));
  const { filter } = await searchParams;
  const items = await prisma.notification.findMany({
    where: { userId: ctx.user.id, dismissedAt: null, ...(filter === "unread" ? { readAt: null } : {}) },
    include: { farm: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100,
  });
  return (
    <>
      <PageHeader title="Notifications" subtitle="Reminders from your tasks, stock, wages, scheme follow-ups, price alerts and weather warnings." actions={<><Link href="/app/settings#notifications" className="text-sm font-medium text-leaf-700 hover:underline">Preferences</Link><MarkAllRead /></>} />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/app/notifications" className={cn("rounded-full border px-3 py-1", !filter ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white")}>All</Link>
        <Link href="/app/notifications?filter=unread" className={cn("rounded-full border px-3 py-1", filter === "unread" ? "border-leaf-700 bg-leaf-800 text-white" : "border-line bg-white")}>Unread</Link>
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={<Bell className="h-6 w-6" />} title="You're all caught up" body="Notifications appear when tasks are due, stock runs low, wages are pending, or a heavy-rain warning is forecast for your farm." /></Card>
      ) : (
        <Card className="overflow-hidden"><ul className="divide-y divide-line">
          {items.map((n) => {
            const I = ICON[n.type as keyof typeof ICON] ?? Bell;
            return (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3 sm:px-5", !n.readAt && "bg-leaf-50/60")}>
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.type === "WEATHER" || n.type === "PAYMENT" ? "bg-amber-100 text-amber-900" : "bg-leaf-100 text-leaf-800")}><I className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  {n.link ? <Link href={n.link} className={cn("text-sm hover:underline", !n.readAt && "font-semibold")}>{n.title}</Link> : <p className={cn("text-sm", !n.readAt && "font-semibold")}>{n.title}</p>}
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="mt-0.5 text-xs text-muted">{dateTime(n.createdAt)}{n.farm ? ` · ${n.farm.name}` : ""}</p>
                </div>
                <NotificationActions id={n.id} read={!!n.readAt} />
              </li>
            );
          })}
        </ul></Card>
      )}
    </>
  );
}
