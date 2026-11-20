import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { priceAlertSchema } from "@/lib/validation/schemas";

export const GET = authed(async (_req, user) => json({ alerts: await prisma.priceAlert.findMany({ where: { userId: user.id } }) }));
export const POST = authed(async (req, user) => {
  const d = priceAlertSchema.parse(await readJson(req));
  return json({ alert: await prisma.priceAlert.create({ data: { ...d, userId: user.id } }) }, 201);
});
export const DELETE = authed(async (req, user) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.priceAlert.deleteMany({ where: { id, userId: user.id } });
  return json({ ok: true });
});
