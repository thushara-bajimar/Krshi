import { prisma } from "@/lib/db";
import { authed, json } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { requireFarmPermission } from "@/lib/authz";
import { MAX_UPLOAD_BYTES, saveFile, sniff } from "@/server/storage";

const TARGETS = {
  activity: { field: "activityId", find: (id: string) => prisma.activity.findUnique({ where: { id }, select: { farmId: true } }), perm: "write" },
  expense: { field: "expenseId", find: (id: string) => prisma.expense.findUnique({ where: { id }, select: { farmId: true } }), perm: "finance:write" },
  soilTest: { field: "soilTestId", find: (id: string) => prisma.soilTest.findUnique({ where: { id }, select: { farmId: true } }), perm: "write" },
  issue: { field: "issueId", find: (id: string) => prisma.cropIssue.findUnique({ where: { id }, select: { farmId: true } }), perm: "write" },
} as const;

export const POST = authed(async (req, user) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Expected a file upload");
  const target = String(form.get("target") ?? "") as keyof typeof TARGETS;
  const targetId = String(form.get("targetId") ?? "");
  const file = form.get("file");
  if (!(target in TARGETS)) throw badRequest("Unknown attachment target");
  if (!(file instanceof File)) throw badRequest("Choose a file");
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest("File is larger than 5 MB. Please use a smaller photo.");
  const t = TARGETS[target];
  const rec = await t.find(targetId);
  if (!rec) throw badRequest("Record not found");
  await requireFarmPermission(user.id, rec.farmId, t.perm);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw badRequest("Only JPEG, PNG, WebP photos or PDF documents are allowed");
  const count = await prisma.attachment.count({ where: { [t.field]: targetId } });
  if (count >= 10) throw badRequest("A record can have at most 10 attachments");
  const storagePath = await saveFile(rec.farmId, buf, kind.ext);
  const name = (file.name || `upload.${kind.ext}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const att = await prisma.attachment.create({
    data: { farmId: rec.farmId, [t.field]: targetId, fileName: name, mimeType: kind.mime, size: buf.length, storagePath, uploadedById: user.id },
  });
  return json({ attachment: att }, 201);
}, { limit: 30 });
