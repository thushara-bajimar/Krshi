import { authed, json, readJson } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { isEntity } from "@/server/records/registry";
import { mutateRecord } from "@/server/records/service";

export const PATCH = authed<{ entity: string; id: string }>(async (req, user, { entity, id }) => {
  if (!isEntity(entity)) throw badRequest("Unknown record type");
  const body = (await readJson(req)) as { data?: unknown; baseVersion?: number };
  const r = await mutateRecord({
    userId: user.id, entity, op: "update", id, payload: body.data ?? body,
    baseVersion: typeof body.baseVersion === "number" ? body.baseVersion : undefined,
    mutationId: req.headers.get("x-mutation-id"),
  });
  return json(r.body, r.status);
});

export const DELETE = authed<{ entity: string; id: string }>(async (req, user, { entity, id }) => {
  if (!isEntity(entity)) throw badRequest("Unknown record type");
  const r = await mutateRecord({ userId: user.id, entity, op: "delete", id, mutationId: req.headers.get("x-mutation-id") });
  return json(r.body, r.status);
});
