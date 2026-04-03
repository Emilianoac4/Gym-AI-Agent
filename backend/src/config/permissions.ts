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
  | "permissions.grant"
  | "trainer.presence.read"
  | "trainer.presence.write"
  | "reports.membership.read"
  | "notifications.general.send"
  | "notifications.messages.read"
  | "notifications.messages.write";

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
    "trainer.presence.read",
    "reports.membership.read",
    "notifications.general.send",
    "notifications.messages.read",
    "notifications.messages.write",
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
    "trainer.presence.write",
    "notifications.messages.read",
    "notifications.messages.write",
  ],
  member: [
    "users.profile.read",
    "users.profile.update",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
    "availability.read",
    "notifications.messages.read",
    "notifications.messages.write",
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
