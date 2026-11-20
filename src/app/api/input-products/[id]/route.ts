import { prisma } from "@/lib/db";
import { authed, json } from "@/lib/http";

export const DELETE = authed<{ id: string }>(async (_req, user, { id }) => {
  await prisma.inputProduct.deleteMany({ where: { id, userId: user.id } });
  return json({ ok: true });
});
