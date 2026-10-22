/** Role vocabulary stored by Better Auth: `member` | `admin` (same as `ROLES`). */
export const BETTER_AUTH_DEFAULT_ROLE = "member"

/** Claims of the minted data-backend JWT. */
export function jwtPayload(user: {
  role?: string
  name: string
  email: string
}) {
  return {
    role: user.role ?? BETTER_AUTH_DEFAULT_ROLE,
    name: user.name,
    email: user.email,
  }
}
