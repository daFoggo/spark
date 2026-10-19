import { ACCOUNT_PATH, DASHBOARD_PATH, MEMBERS_PATH } from "@/config/routes"
import type { Permission } from "@/lib/auth/permissions"

export type NavLink = { title: string; href: string; permission: Permission }
/** A collapsible group inside a section; the tree stays at most two levels deep. */
export type NavGroup = { title: string; items: NavLink[] }
export type NavEntry = NavLink | NavGroup
/** One labelled block of the sidebar. Add sections freely; empty ones are hidden. */
export type NavSection = { label: string; entries: NavEntry[] }
export type Crumb = { label: string; href?: string }

/**
 * Dashboard navigation. Hrefs mirror the breadcrumb (`dashboard / settings / account`).
 * `permission` only hides links; each page still calls `requirePermission`.
 */
export const DASHBOARD_NAV: NavSection[] = [
  {
    label: "Workspace",
    entries: [
      { title: "Overview", href: DASHBOARD_PATH, permission: "dashboard:view" },
    ],
  },
  {
    label: "Settings",
    entries: [
      { title: "Account", href: ACCOUNT_PATH, permission: "settings:view" },
      { title: "Members", href: MEMBERS_PATH, permission: "members:view" },
    ],
  },
]

/**
 * Keeps the links `can` allows and drops groups or sections left empty. Takes a predicate so
 * this module stays free of auth code and is safe to import from client components.
 */
export function filterNav(
  sections: NavSection[],
  can: (permission: Permission) => boolean
): NavSection[] {
  return sections.flatMap((section) => {
    const entries = section.entries.flatMap<NavEntry>((entry) => {
      if (!("items" in entry)) return can(entry.permission) ? [entry] : []
      const items = entry.items.filter((item) => can(item.permission))
      return items.length ? [{ ...entry, items }] : []
    })
    return entries.length ? [{ ...section, entries }] : []
  })
}

export function navLinks(sections: NavSection[]): NavLink[] {
  return sections.flatMap((section) =>
    section.entries.flatMap((entry) =>
      "items" in entry ? entry.items : [entry]
    )
  )
}

/**
 * Path-style trail from the URL: `dashboard / settings / account`. A segment links when it is a
 * page in the nav; an index page (`/dashboard`) appends its own title (`dashboard / overview`).
 */
export function breadcrumbTrail(
  pathname: string,
  sections: NavSection[]
): Crumb[] {
  const links = navLinks(sections)
  const segments = pathname.split("/").filter(Boolean)
  const crumbs: Crumb[] = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    return {
      label: segment,
      href: links.some((link) => link.href === href) ? href : undefined,
    }
  })
  const title = links
    .find((link) => link.href === pathname)
    ?.title.toLowerCase()
  if (title && title !== segments.at(-1)) crumbs.push({ label: title })
  return crumbs
}
