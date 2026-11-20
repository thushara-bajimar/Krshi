import { authed, json, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { isEntity } from "@/server/records/registry";
import { mutateRecord } from "@/server/records/service";
import { listRecords } from "@/server/records/queries";

export const POST = authed<{ entity: string }>(async (req, user, { entity }) => {
  if (!isEntity(entity)) throw badRequest("Unknown record type");
  const payload = await readJson(req);
  const r = await mutateRecord({ userId: user.id, entity, op: "create", payload, mutationId: req.headers.get("x-mutation-id") });
  return json(r.body, r.status);
});

// List records of a farm — used to warm the offline cache.
export const GET = authed<{ entity: string }>(async (req, user, { entity }) => {
  if (!isEntity(entity)) throw badRequest("Unknown record type");
  const url = new URL(req.url);
  const farmId = url.searchParams.get("farmId");
  if (!farmId) throw badRequest("farmId is required");
  return json({ records: await listRecords(user.id, entity, farmId, url.searchParams) });
});
