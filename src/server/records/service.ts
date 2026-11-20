import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, type Permission } from "@/lib/authz";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { serialize } from "@/lib/serialize";
import { ENTITIES, type EntityName } from "./registry";

type Op = "create" | "update" | "delete";

async function roleFor(tx: Prisma.TransactionClient, userId: string, farmId: string) {
  const m = await tx.farmMembership.findUnique({ where: { farmId_userId: { farmId, userId } } });
  if (!m) throw notFound("Farm not found");
  return m.role;
}

function needed(sensitive: boolean, op: Op | "read"): Permission {
  if (op === "read") return sensitive ? "finance:read" : "read";
  return sensitive ? "finance:write" : "write";
}

export interface MutationResult {
  status: number;
  body: unknown;
}

/**
 * Executes a record mutation inside one database transaction:
 *  1. idempotency — a replayed mutation id returns the stored response (offline sync safety)
 *  2. authorization — the user's farm role must grant the needed permission (server-side, always)
 *  3. idempotent create — a client-supplied id that already exists returns the existing record
 *  4. optimistic concurrency — updates carrying `baseVersion` are rejected with 409 if the server copy is newer
 */
export async function mutateRecord(args: {
  userId: string;
  entity: EntityName;
  op: Op;
  id?: string;
  payload?: unknown;
  baseVersion?: number;
  mutationId?: string | null;
}): Promise<MutationResult> {
  const def = ENTITIES[args.entity];
  if (args.mutationId) {
    const seen = await prisma.processedMutation.findUnique({ where: { id: args.mutationId } });
    if (seen && seen.userId === args.userId) return { status: seen.status, body: { ...(seen.response as object), replayed: true } };
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const mk = async (farmId: string) => {
        const role = await roleFor(tx, args.userId, farmId);
        const perm = needed(def.sensitive, args.op);
        if (!can(role, perm)) throw forbidden(`Your role (${role.toLowerCase().replace("_", " ")}) cannot change these records`);
        return { tx, userId: args.userId, can: (p: Permission) => can(role, p) };
      };

      if (args.op === "create") {
        const data = def.createSchema.parse(args.payload);
        const farmId = await def.farmIdFor(tx, data);
        const ctx = await mk(farmId);
        if (data.id) {
          const existing = await def.load(tx, data.id);
          if (existing) {
            if (existing.farmId !== farmId) throw conflict("This record id is already used");
            return { status: 200, body: { record: serialize(existing.record), duplicate: true } };
          }
        }
        const rec = await def.create(ctx, data, farmId);
        return { status: 201, body: { record: serialize(rec) } };
      }

      const existing = await def.load(tx, args.id!);
      if (!existing) throw notFound("Record not found");
      const ctx = await mk(existing.farmId);

      if (args.op === "delete") {
        if (existing.deleted) return { status: 200, body: { ok: true, alreadyDeleted: true } };
        await def.remove(ctx, existing);
        return { status: 200, body: { ok: true } };
      }

      // update
      if (!def.update || !def.updateSchema) throw forbidden("These records cannot be edited");
      if (existing.deleted) {
        return { status: 409, body: { error: "This record was deleted on another device", conflict: "deleted", server: null } };
      }
      if (args.baseVersion != null && existing.version != null && existing.version !== args.baseVersion) {
        return {
          status: 409,
          body: { error: "This record was changed by someone else since you opened it", conflict: "version", server: serialize(existing.record) },
        };
      }
      const raw = { ...(args.payload as object), farmId: existing.farmId };
      const data = def.updateSchema.parse(raw);
      const rec = await def.update(ctx, existing, data);
      return { status: 200, body: { record: serialize(rec) } };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
  );

  if (args.mutationId && result.status < 500) {
    await prisma.processedMutation
      .create({
        data: {
          id: args.mutationId,
          userId: args.userId,
          entity: args.entity,
          entityId: (result.body as { record?: { id?: string } })?.record?.id ?? args.id ?? null,
          status: result.status,
          response: result.body as Prisma.InputJsonValue,
        },
      })
      .catch(() => {}); // a concurrent replay already stored it
  }
  return result;
}

export async function checkReadAccess(userId: string, entity: EntityName, farmId: string) {
  const role = await roleFor(prisma, userId, farmId);
  if (!can(role, needed(ENTITIES[entity].sensitive, "read"))) throw forbidden();
  return role;
}
