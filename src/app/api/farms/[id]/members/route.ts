import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { shareSchema } from "@/lib/validation/schemas";
import { requireFarmPermission } from "@/lib/authz";
import { badRequest, notFound } from "@/lib/errors";
import { z } from "zod";

export const GET = authed<{ id: string }>(async (_req, user, { id }) => {
  await requireFarmPermission(user.id, id, "read");
  const members = await prisma.farmMembership.findMany({ where: { farmId: id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
  return json({ members });
});

// Share with an existing KRSHI account. (No email is sent; the person sees the farm in their farm switcher.)
export const POST = authed<{ id: string }>(async (req, user, { id }) => {
  await requireFarmPermission(user.id, id, "manage");
  const d = shareSchema.parse(await readJson(req));
  const target = await prisma.user.findUnique({ where: { email: d.email } });
  if (!target) throw notFound("No KRSHI account uses that email. Ask them to register first.");
  if (target.id === user.id) throw badRequest("You already own this farm");
  const m = await prisma.farmMembership.upsert({
    where: { farmId_userId: { farmId: id, userId: target.id } },
    update: { role: d.role },
    create: { farmId: id, userId: target.id, role: d.role, invitedById: user.id },
  });
  await prisma.notification.create({
    data: { userId: target.id, farmId: id, type: "SYSTEM", title: "A farm was shared with you", body: `${user.name} gave you ${d.role.toLowerCase().replace("_", " ")} access.`, link: "/app", dedupeKey: `share:${id}:${Date.now()}` },
  });
  return json({ membership: m }, 201);
});

export const PATCH = authed<{ id: string }>(async (req, user, { id }) => {
  await requireFarmPermission(user.id, id, "manage");
  const d = z.object({ membershipId: z.string().uuid(), role: z.enum(["MANAGER", "FINANCE_VIEWER", "VIEWER"]) }).parse(await readJson(req));
  const m = await prisma.farmMembership.findFirst({ where: { id: d.membershipId, farmId: id } });
  if (!m) throw notFound();
  if (m.role === "OWNER") throw badRequest("The owner's role cannot be changed");
  return json({ membership: await prisma.farmMembership.update({ where: { id: m.id }, data: { role: d.role } }) });
});

export const DELETE = authed<{ id: string }>(async (req, user, { id }) => {
  const membershipId = new URL(req.url).searchParams.get("membershipId");
  const m = await prisma.farmMembership.findFirst({ where: { id: membershipId ?? "", farmId: id } });
  if (!m) throw notFound();
  // owners can revoke anyone except themselves; members can remove themselves
  if (m.userId !== user.id) await requireFarmPermission(user.id, id, "manage");
  if (m.role === "OWNER") throw badRequest("The owner cannot be removed");
  await prisma.farmMembership.delete({ where: { id: m.id } });
  return json({ ok: true });
});
