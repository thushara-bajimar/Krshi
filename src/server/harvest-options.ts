import "server-only";
import { prisma } from "@/lib/db";
import { date } from "@/lib/format";

/** Harvests with unsold quantity, for linking sales. */
export async function harvestOptions(farmId: string) {
  const hs = await prisma.harvest.findMany({ where: { farmId, deletedAt: null }, include: { crop: true, plot: true, sales: { where: { deletedAt: null } } }, orderBy: { date: "desc" }, take: 50 });
  return hs
    .map((h) => ({ id: h.id, label: `${h.crop.name}${h.plot ? ` (${h.plot.name})` : ""} · ${date(h.date)}`, unit: h.unit, cropId: h.cropId, remaining: Math.round((Number(h.quantity) - h.sales.reduce((a, s) => a + Number(s.quantity ?? 0), 0)) * 1000) / 1000 }))
    .filter((h) => h.remaining > 0);
}
