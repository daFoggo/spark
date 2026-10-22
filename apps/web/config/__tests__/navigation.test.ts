import { describe, expect, it } from "vitest"

import {
  breadcrumbTrail,
  DASHBOARD_NAV,
  filterNav,
  navLinks,
  type NavSection,
} from "../navigation"

const sections: NavSection[] = [
  {
    label: "Workspace",
    entries: [
      {
        title: "Today",
        href: "/dashboard",
        icon: "today",
        permission: "dashboard:view",
      },
    ],
  },
  {
    label: "Settings",
    entries: [
      {
        title: "Account",
        href: "/dashboard/settings/account",
        icon: "account",
        permission: "settings:view",
      },
      {
        title: "More",
        items: [
          {
            title: "Preferences",
            href: "/dashboard/settings/preferences",
            icon: "preferences",
            permission: "settings:view",
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

    const noSettings = filterNav(sections, (p) => p !== "settings:view")
    expect(navLinks(noSettings).map((l) => l.title)).toEqual(["Today"])

    const all = filterNav(sections, () => true)
    expect(navLinks(all).map((l) => l.title)).toEqual([
      "Today",
      "Account",
      "Preferences",
    ])
  })
})

describe("breadcrumbTrail", () => {
  it("appends the page title on an index route", () => {
    expect(breadcrumbTrail("/dashboard", sections)).toEqual([
      { label: "dashboard", href: "/dashboard" },
      { label: "today" },
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

  it("shows a record's name when one is known", () => {
    const id = "29ef238d-7877-4eae-a21c-808a9e16b1e4"
    expect(
      breadcrumbTrail(`/dashboard/habits/${id}`, sections, { [id]: "Run" }).at(
        -1
      )
    ).toEqual({ label: "Run", href: undefined })
  })

  it("shows a record id as details", () => {
    expect(
      breadcrumbTrail(
        "/dashboard/habits/29ef238d-7877-4eae-a21c-808a9e16b1e4",
        sections
      ).at(-1)
    ).toEqual({ label: "details", href: undefined })
  })
})
