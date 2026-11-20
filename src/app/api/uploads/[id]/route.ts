import { prisma } from "@/lib/db";
import { authed, json } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireFarmPermission } from "@/lib/authz";
import { deleteStored, readStored } from "@/server/storage";

export const GET = authed<{ id: string }>(async (_req, user, { id }) => {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw notFound();
  await requireFarmPermission(user.id, att.farmId, att.expenseId ? "finance:read" : "read");
  const buf = await readStored(att.storagePath).catch(() => null);
  if (!buf) throw notFound("File missing from storage");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `inline; filename="${att.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});

export const DELETE = authed<{ id: string }>(async (_req, user, { id }) => {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw notFound();
  await requireFarmPermission(user.id, att.farmId, att.expenseId ? "finance:write" : "write");
  await prisma.attachment.delete({ where: { id } });
  await deleteStored(att.storagePath);
  return json({ ok: true });
});
