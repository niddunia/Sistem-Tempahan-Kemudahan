/**
 * Role-Based Access Control (RBAC) per PRD §4 & §10
 * Roles: USER | FACILITY_ADMIN | SUPER_ADMIN
 * PRD §10: "Kawalan akses berasaskan peranan (RBAC)"
 */
export type Role = 'USER' | 'FACILITY_ADMIN' | 'SUPER_ADMIN';

export const ROLE_HIERARCHY: Record<Role, number> = {
  USER: 1,
  FACILITY_ADMIN: 2,
  SUPER_ADMIN: 3,
};

/**
 * Returns true if the user's role meets or exceeds the required role.
 */
export function hasRole(userRole: string | undefined, required: Role): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole as Role] ?? 0) >= ROLE_HIERARCHY[required];
}

export function isFacilityAdminOrAbove(userRole: string | undefined): boolean {
  return hasRole(userRole, 'FACILITY_ADMIN');
}

export function isSuperAdmin(userRole: string | undefined): boolean {
  return hasRole(userRole, 'SUPER_ADMIN');
}
