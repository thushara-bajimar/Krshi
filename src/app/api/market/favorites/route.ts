import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { z } from "zod";

export const POST = authed(async (req, user) => {
  const d = z.object({ kind: z.enum(["CROP", "MARKET"]), value: z.string().min(1).max(100) }).parse(await readJson(req));
  const existing = await prisma.marketFavorite.findUnique({ where: { userId_kind_value: { userId: user.id, ...d } } });
  if (existing) await prisma.marketFavorite.delete({ where: { id: existing.id } });
  else await prisma.marketFavorite.create({ data: { userId: user.id, ...d } });
  return json({ favorite: !existing });
});
