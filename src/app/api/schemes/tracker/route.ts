import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { schemeTrackerSchema } from "@/lib/validation/schemas";
import { toDate } from "@/server/records/helpers";

export const PUT = authed(async (req, user) => {
  const d = schemeTrackerSchema.parse(await readJson(req));
  const data = { ...d, followUpDate: toDate(d.followUpDate), applicationRef: d.applicationRef ?? null, notes: d.notes ?? null };
  const t = await prisma.schemeTracker.upsert({ where: { userId_schemeId: { userId: user.id, schemeId: d.schemeId } }, update: data, create: { ...data, userId: user.id } });
  return json({ tracker: t });
});

export const DELETE = authed(async (req, user) => {
  const schemeId = new URL(req.url).searchParams.get("schemeId") ?? "";
  await prisma.schemeTracker.deleteMany({ where: { userId: user.id, schemeId } });
  return json({ ok: true });
});
