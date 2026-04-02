import { PermissionGrantAction } from "@prisma/client";
import { prisma } from "./prisma";

export type PermissionAction =
  | "users.list"
  | "users.create"
  | "users.profile.read"
  | "users.profile.update"
  | "users.deactivate"
  | "users.reactivate"
  | "users.renewMembership"
  | "users.delete"
  | "users.measurements.read"
  | "users.measurements.write"
  | "ai.use"
  | "availability.read"
  | "availability.write"
  | "permissions.grant";

type AppRole = "admin" | "trainer" | "member";

const rolePermissions: Record<AppRole, PermissionAction[]> = {
  admin: [
    "users.list",
    "users.create",
    "users.profile.read",
    "users.profile.update",
    "users.deactivate",
    "users.reactivate",
    "users.renewMembership",
    "users.delete",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
    "availability.read",
    "availability.write",
    "permissions.grant",
  ],
  trainer: [
    "users.list",
    "users.create",
    "users.profile.read",
    "users.profile.update",
    "users.deactivate",
    "users.reactivate",
    "users.renewMembership",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
    "availability.read",
  ],
  member: [
    "users.profile.read",
    "users.profile.update",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
    "availability.read",
  ],
};

const permissionGrantMap: Partial<Record<PermissionAction, PermissionGrantAction>> = {
  "availability.write": PermissionGrantAction.availability_write,
};

export const hasPermission = (role: string, action: PermissionAction): boolean => {
  const normalizedRole = role as AppRole;
  return rolePermissions[normalizedRole]?.includes(action) ?? false;
};

export const hasPermissionForUser = async (
  userId: string,
  role: string,
  action: PermissionAction,
): Promise<boolean> => {
  if (hasPermission(role, action)) {
    return true;
  }

  const permissionGrant = permissionGrantMap[action];
  if (!permissionGrant) {
    return false;
  }

  const grant = await prisma.userPermissionGrant.findUnique({
    where: {
      userId_permissionAction: {
        userId,
        permissionAction: permissionGrant,
      },
    },
    select: { id: true },
  });

  return Boolean(grant);
};
