import "server-only";
import type { FarmRole } from "@prisma/client";
import { prisma } from "./db";
import { forbidden, notFound } from "./errors";
import { getCurrentUser } from "./auth/session";

export type Permission = "read" | "write" | "finance:read" | "finance:write" | "manage";

export const ROLE_PERMISSIONS: Record<FarmRole, Permission[]> = {
  OWNER: ["read", "write", "finance:read", "finance:write", "manage"],
  MANAGER: ["read", "write", "finance:read", "finance:write"],
  FINANCE_VIEWER: ["read", "finance:read"],
  VIEWER: ["read"],
};

export const can = (role: FarmRole, p: Permission) => ROLE_PERMISSIONS[role].includes(p);

/** Server-side authorization: throws 404 if the user has no membership (do not leak existence), 403 if role lacks the permission. */
export async function requireFarmPermission(userId: string, farmId: string, permission: Permission) {
  const membership = await prisma.farmMembership.findUnique({
    where: { farmId_userId: { farmId, userId } },
    include: { farm: true },
  });
  if (!membership) throw notFound("Farm not found");
  if (!can(membership.role, permission)) throw forbidden(`Your role (${membership.role.replace("_", " ").toLowerCase()}) does not allow this`);
  return membership;
}

export async function listUserFarms(userId: string) {
  const ms = await prisma.farmMembership.findMany({
    where: { userId },
    include: { farm: true },
    orderBy: { farm: { createdAt: "asc" } },
  });
  return ms.map((m) => ({ ...m.farm, role: m.role }));
}

/**
 * Context for app pages: the signed-in user, their farms and the currently selected farm.
 * The selected farm is stored in user settings so it follows the user across devices.
 */
export async function getFarmContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const farms = await listUserFarms(user.id);
  const selected = farms.find((f) => f.id === user.settings?.currentFarmId) ?? farms[0] ?? null;
  return {
    user,
    farms,
    farm: selected,
    role: selected?.role ?? null,
    can: (p: Permission) => (selected ? can(selected.role, p) : false),
  };
}
