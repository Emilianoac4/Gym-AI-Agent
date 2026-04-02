export type PermissionAction =
  | "users.profile.read"
  | "users.profile.update"
  | "users.deactivate"
  | "users.measurements.read"
  | "users.measurements.write"
  | "ai.use";

type AppRole = "admin" | "trainer" | "member";

const rolePermissions: Record<AppRole, PermissionAction[]> = {
  admin: [
    "users.profile.read",
    "users.profile.update",
    "users.deactivate",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
  ],
  trainer: [
    "users.profile.read",
    "users.profile.update",
    "users.deactivate",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
  ],
  member: [
    "users.profile.read",
    "users.profile.update",
    "users.measurements.read",
    "users.measurements.write",
    "ai.use",
  ],
};

export const hasPermission = (role: string, action: PermissionAction): boolean => {
  const normalizedRole = role as AppRole;
  return rolePermissions[normalizedRole]?.includes(action) ?? false;
};
