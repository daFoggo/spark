import { describe, expect, it } from "vitest"

import {
  breadcrumbTrail,
  DASHBOARD_NAV,
  filterNav,
  navLinks,
  type NavSection,
} from "./navigation"

const sections: NavSection[] = [
  {
    label: "Workspace",
    entries: [
      { title: "Overview", href: "/dashboard", permission: "dashboard:view" },
    ],
  },
  {
    label: "Settings",
    entries: [
      {
        title: "Account",
        href: "/dashboard/settings/account",
        permission: "settings:view",
      },
      {
        title: "Admin",
        items: [
          {
            title: "Members",
            href: "/dashboard/settings/members",
            permission: "members:view",
          },
        ],
      },
    ],
  },
]

describe("filterNav", () => {
  it("drops links, empty groups and empty sections the predicate rejects", () => {
    const onlyDashboard = filterNav(sections, (p) => p === "dashboard:view")
    expect(onlyDashboard.map((s) => s.label)).toEqual(["Workspace"])

    const noMembers = filterNav(sections, (p) => p !== "members:view")
    expect(navLinks(noMembers).map((l) => l.title)).toEqual([
      "Overview",
      "Account",
    ])
  })
})

describe("breadcrumbTrail", () => {
  it("appends the page title on an index route", () => {
    expect(breadcrumbTrail("/dashboard", sections)).toEqual([
      { label: "dashboard", href: "/dashboard" },
      { label: "overview" },
    ])
  })

  it("links only segments that are nav pages", () => {
    expect(breadcrumbTrail("/dashboard/settings/account", sections)).toEqual([
      { label: "dashboard", href: "/dashboard" },
      { label: "settings", href: undefined },
      { label: "account", href: "/dashboard/settings/account" },
    ])
  })
})

describe("DASHBOARD_NAV", () => {
  it("has unique hrefs", () => {
    const hrefs = navLinks(DASHBOARD_NAV).map((l) => l.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
