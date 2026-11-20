import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";
import { passwordChangeSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { badRequest } from "@/lib/errors";

export const POST = authed(async (req, user) => {
  const d = passwordChangeSchema.parse(await readJson(req));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(d.currentPassword, u.passwordHash))) throw badRequest("Current password is incorrect");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(d.newPassword) } }),
    // sign out every other device
    prisma.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } }),
  ]);
  return json({ ok: true });
}, { limit: 5, windowMs: 15 * 60 * 1000 });
