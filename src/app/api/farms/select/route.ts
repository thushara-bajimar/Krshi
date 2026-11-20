import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { requireFarmPermission } from "@/lib/authz";
import { z } from "zod";

export const POST = authed(async (req, user) => {
  const { farmId } = z.object({ farmId: z.string().uuid() }).parse(await readJson(req));
  await requireFarmPermission(user.id, farmId, "read");
  await prisma.userSettings.upsert({ where: { userId: user.id }, update: { currentFarmId: farmId }, create: { userId: user.id, currentFarmId: farmId } });
  return json({ ok: true });
});
