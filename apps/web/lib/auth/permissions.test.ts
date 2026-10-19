import { describe, expect, it } from "vitest"

import { hasPermission, parseRole, permissionsOf } from "./permissions"

describe("parseRole", () => {
  it("accepts known roles and falls back to member for anything else", () => {
    expect(parseRole("admin")).toBe("admin")
    expect(parseRole("member")).toBe("member")
    for (const value of [undefined, null, "", "Admin", "owner", 1, {}]) {
      expect(parseRole(value)).toBe("member")
    }
  })
})

describe("hasPermission", () => {
  it("grants members only the basics", () => {
    expect(hasPermission("member", "dashboard:view")).toBe(true)
    expect(hasPermission("member", "members:view")).toBe(false)
    expect(hasPermission("member", "members:manage")).toBe(false)
  })

  it("grants admins every permission a member has", () => {
    for (const permission of permissionsOf("member")) {
      expect(hasPermission("admin", permission)).toBe(true)
    }
    expect(hasPermission("admin", "members:manage")).toBe(true)
  })
})
