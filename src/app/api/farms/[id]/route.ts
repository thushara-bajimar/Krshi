import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { farmSchema } from "@/lib/validation/schemas";
import { requireFarmPermission } from "@/lib/authz";

export const PATCH = authed<{ id: string }>(async (req, user, { id }) => {
  await requireFarmPermission(user.id, id, "write");
  const d = farmSchema.parse(await readJson(req));
  const farm = await prisma.farm.update({
    where: { id },
    data: { ...d, taluk: d.taluk ?? null, village: d.village ?? null, location: d.location ?? null, latitude: d.latitude ?? null, longitude: d.longitude ?? null, totalArea: d.totalArea ?? null, description: d.description ?? null },
  });
  return json({ farm });
});

export const DELETE = authed<{ id: string }>(async (_req, user, { id }) => {
  await requireFarmPermission(user.id, id, "manage");
  await prisma.farm.delete({ where: { id } });
  await prisma.userSettings.updateMany({ where: { currentFarmId: id }, data: { currentFarmId: null } });
  return json({ ok: true });
});
