import { z } from "zod";
import { prisma } from "@/lib/db";
import { authed, json, readJson } from "@/lib/http";

export const PATCH = authed(async (req, user) => {
  const d = z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional(), action: z.enum(["read", "unread", "dismiss"]) }).parse(await readJson(req));
  const where = { userId: user.id, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) };
  const data = d.action === "read" ? { readAt: new Date() } : d.action === "unread" ? { readAt: null } : { dismissedAt: new Date(), readAt: new Date() };
  const r = await prisma.notification.updateMany({ where, data });
  return json({ updated: r.count });
});
