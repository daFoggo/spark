/** Roles live in `app_metadata.role` (writable only by an admin path), never in `user_metadata`. */
export const ROLES = ["member", "admin"] as const
export type Role = (typeof ROLES)[number]

/** What each role may do. UI hides what a role lacks; pages and actions enforce it via the DAL, the database via RLS. */
const PERMISSIONS = {
  member: ["dashboard:view", "settings:view"],
  admin: ["dashboard:view", "settings:view", "members:view", "members:manage"],
} as const satisfies Record<Role, readonly string[]>

export type Permission = (typeof PERMISSIONS)[Role][number]

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[role] as readonly Permission[]).includes(permission)
}

export function permissionsOf(role: Role): readonly Permission[] {
  return PERMISSIONS[role]
}

/** Unknown or missing values fall back to the least privileged role. */
export function parseRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "member"
}
