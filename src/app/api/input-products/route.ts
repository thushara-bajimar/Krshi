import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { inputProductSchema } from "@/lib/validation/schemas";

export const GET = authed(async (_req, user) => json({ products: await prisma.inputProduct.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }) }));

export const POST = authed(async (req, user) => {
  const d = inputProductSchema.parse(await readJson(req));
  const p = await prisma.inputProduct.upsert({ where: { userId_name: { userId: user.id, name: d.name } }, update: d, create: { ...d, userId: user.id } });
  return json({ product: p }, 201);
});
