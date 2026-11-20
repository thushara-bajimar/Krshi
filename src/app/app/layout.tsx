import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getFarmContext } from "@/lib/authz";
import { AppDataProvider, type AppData } from "@/components/app/app-data";
import { AppShell } from "@/components/app/shell";
import { SyncProvider } from "@/offline/sync-provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getFarmContext();
  if (!ctx) redirect("/login");
  const { user, farm, farms } = ctx;
  const farmId = farm?.id;

  const [plots, crops, workers, inventory, unread] = await Promise.all([
    farmId ? prisma.plot.findMany({ where: { farmId }, include: { crop: true }, orderBy: { name: "asc" } }) : [],
    prisma.crop.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
    farmId ? prisma.worker.findMany({ where: { farmId }, orderBy: { name: "asc" } }) : [],
    farmId ? prisma.inventoryItem.findMany({ where: { farmId, deletedAt: null }, orderBy: { name: "asc" } }) : [],
    prisma.notification.count({ where: { userId: user.id, readAt: null, dismissedAt: null } }),
  ]);

  const data: AppData = {
    user: { id: user.id, name: user.name, email: user.email, language: user.language, district: user.district, areaUnit: user.areaUnit },
    farm: farm ? { id: farm.id, name: farm.name, district: farm.district, areaUnit: farm.areaUnit, latitude: farm.latitude == null ? null : Number(farm.latitude), longitude: farm.longitude == null ? null : Number(farm.longitude) } : null,
    farms: farms.map((f) => ({ id: f.id, name: f.name, role: f.role })),
    role: ctx.role,
    perms: { write: ctx.can("write"), financeRead: ctx.can("finance:read"), financeWrite: ctx.can("finance:write"), manage: ctx.can("manage") },
    plots: plots.map((p) => ({ id: p.id, name: p.name, cropId: p.cropId, cropName: p.crop?.name ?? null, area: Number(p.area), areaUnit: p.areaUnit, plantCount: p.plantCount, status: p.status })),
    crops: crops.map((c) => ({ id: c.id, key: c.key, name: c.name, nameKn: c.nameKn })),
    workers: workers.map((w) => ({ id: w.id, name: w.name, category: w.category, defaultWage: w.defaultWage == null ? null : Number(w.defaultWage), wageType: w.wageType, active: w.active })),
    inventory: inventory.map((i) => ({ id: i.id, name: i.name, unit: i.unit, quantity: Number(i.quantity), category: i.category })),
    renderedAt: new Date().toISOString(),
  };

  return (
    <AppDataProvider value={data}>
      <SyncProvider>
        <AppShell unread={unread}>{children}</AppShell>
      </SyncProvider>
    </AppDataProvider>
  );
}
