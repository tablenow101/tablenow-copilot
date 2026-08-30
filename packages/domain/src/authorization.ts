import type { Role } from "@tablenow/contracts";

export const permissions = [
  "workspace.read",
  "reservation.write",
  "operations.write",
  "team.write",
  "inventory.write",
  "copilot.propose",
  "copilot.approve.low",
  "copilot.approve.high",
  "computer_use.read",
  "computer_use.configure",
  "computer_use.execute",
  "computer_use.approve.high",
  "tenant.manage",
  "privacy.manage",
  "pilot.manage",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  platform_admin: new Set(permissions),
  owner: new Set(permissions.filter((permission) => permission !== "pilot.manage")),
  group_admin: new Set(permissions.filter((permission) => permission !== "pilot.manage")),
  manager: new Set([
    "workspace.read",
    "reservation.write",
    "operations.write",
    "team.write",
    "inventory.write",
    "copilot.propose",
    "copilot.approve.low",
    "computer_use.read",
    "computer_use.execute",
    "privacy.manage",
  ]),
  operator: new Set([
    "workspace.read",
    "reservation.write",
    "operations.write",
    "inventory.write",
    "copilot.propose",
    "computer_use.read",
    "computer_use.execute",
  ]),
  viewer: new Set(["workspace.read", "computer_use.read"]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`FORBIDDEN:${permission}`);
  }
}
