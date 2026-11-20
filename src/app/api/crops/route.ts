import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { cropSchema } from "@/lib/validation/schemas";

export const GET = authed(async () => json({ crops: await prisma.crop.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] }) }));

export const POST = authed(async (req) => {
  const d = cropSchema.parse(await readJson(req));
  const key = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `crop-${Date.now()}`;
  const existing = await prisma.crop.findFirst({ where: { OR: [{ key }, { name: { equals: d.name, mode: "insensitive" } }] } });
  if (existing) return json({ crop: existing });
  return json({ crop: await prisma.crop.create({ data: { ...d, key, isSystem: false } }) }, 201);
}, { limit: 20 });
