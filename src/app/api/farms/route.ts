import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { farmSchema } from "@/lib/validation/schemas";
import { listUserFarms } from "@/lib/authz";

export const GET = authed(async (_req, user) => json({ farms: await listUserFarms(user.id) }));

export const POST = authed(async (req, user) => {
  const d = farmSchema.parse(await readJson(req));
  const farm = await prisma.$transaction(async (tx) => {
    const f = await tx.farm.create({ data: { ...d, memberships: { create: { userId: user.id, role: "OWNER" } } } });
    await tx.userSettings.upsert({ where: { userId: user.id }, update: { currentFarmId: f.id }, create: { userId: user.id, currentFarmId: f.id } });
    return f;
  });
  return json({ farm }, 201);
});
