import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { profileSchema, settingsSchema } from "@/lib/validation/schemas";

export const GET = authed(async (_req, user) => json({ user }));

export const PATCH = authed(async (req, user) => {
  const body = (await readJson(req)) as { profile?: unknown; settings?: unknown };
  if (body.profile) {
    const p = profileSchema.parse(body.profile);
    await prisma.user.update({ where: { id: user.id }, data: { ...p, phone: p.phone ?? null, district: p.district ?? null, taluk: p.taluk ?? null, village: p.village ?? null } });
  }
  if (body.settings) {
    const s = settingsSchema.parse(body.settings);
    await prisma.userSettings.upsert({ where: { userId: user.id }, update: s, create: { userId: user.id, ...s } });
  }
  const res = NextResponse.json({ ok: true });
  if (body.profile) res.cookies.set("lang", (body.profile as { language: string }).language, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
});

// Account deletion: removes the user, their sessions and farms they solely own.
export const DELETE = authed(async (_req, user) => {
  const owned = await prisma.farmMembership.findMany({ where: { userId: user.id, role: "OWNER" }, select: { farmId: true } });
  await prisma.$transaction([
    prisma.farm.deleteMany({ where: { id: { in: owned.map((o) => o.farmId) } } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("krishi_session");
  return res;
}, { limit: 3 });
