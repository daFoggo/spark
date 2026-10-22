import type { Permission } from "@workspace/auth/permissions"

import {
  ACCOUNT_PATH,
  DASHBOARD_PATH,
  GOALS_PATH,
  GUIDE_PATH,
  HABITS_PATH,
  PREFERENCES_PATH,
  REVIEW_PATH,
  TASKS_PATH,
} from "@/config/routes"

/**
 * Semantic icon names, resolved to Tabler icons in `components/layout/nav-icons.tsx`. Names (not
 * components) because `entries` cross from a Server Component to the client `NavTree`.
 */
export type NavIconName =
  | "today"
  | "habits"
  | "tasks"
  | "goals"
  | "review"
  | "guide"
  | "account"
  | "preferences"

export type NavLink = {
  title: string
  href: string
  icon: NavIconName
  permission: Permission
  /** Short mono text on the right, e.g. "due". Set at render time, not in the config. */
  badge?: string
  /**
   * Per-link prefetching (`<Link prefetch>`) for pages that read `searchParams`: URL data is not in
   * the shared App Shell, so without it their data waits for the click. Costs one server call per link.
   */
  prefetch?: true
}
/** A collapsible group inside a section; the tree stays at most two levels deep. */
export type NavGroup = { title: string; items: NavLink[] }
export type NavEntry = NavLink | NavGroup
/** One labelled block of the sidebar. Add sections freely; empty ones are hidden. */
export type NavSection = { label: string; entries: NavEntry[] }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Crumb = { label: string; href?: string }

/**
 * Dashboard navigation. Hrefs mirror the breadcrumb (`dashboard / settings / account`).
 * `permission` only hides links; each page still calls `requirePermission`.
 */
export const DASHBOARD_NAV: NavSection[] = [
  {
    label: "Workspace",
    entries: [
      {
        title: "Today",
        href: DASHBOARD_PATH,
        icon: "today",
        permission: "dashboard:view",
        prefetch: true,
      },
      {
        title: "Goals",
        href: GOALS_PATH,
        icon: "goals",
        permission: "dashboard:view",
      },
      {
        title: "Habits",
        href: HABITS_PATH,
        icon: "habits",
        permission: "dashboard:view",
      },
      {
        title: "Tasks",
        href: TASKS_PATH,
        icon: "tasks",
        permission: "dashboard:view",
        prefetch: true,
      },
      {
        title: "Weekly review",
        href: REVIEW_PATH,
        icon: "review",
        permission: "dashboard:view",
      },
    ],
  },
  {
    label: "Help",
    entries: [
      {
        title: "Guide",
        href: GUIDE_PATH,
        icon: "guide",
        permission: "dashboard:view",
      },
    ],
  },
  {
    label: "Settings",
    entries: [
      {
        title: "Account",
        href: ACCOUNT_PATH,
        icon: "account",
        permission: "settings:view",
      },
      {
        title: "Preferences",
        href: PREFERENCES_PATH,
        icon: "preferences",
        permission: "settings:view",
      },
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
  sections: NavSection[],
  /** Names for record ids in the URL (id to name). An id without one reads as "details". */
  labels: Readonly<Record<string, string>> = {}
): Crumb[] {
  const links = navLinks(sections)
  const segments = pathname.split("/").filter(Boolean)
  const crumbs: Crumb[] = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    return {
      // A record id (`/habits/<uuid>`) reads as its name, or "details", never as 36 characters.
      label: UUID.test(segment) ? (labels[segment] ?? "details") : segment,
      href: links.some((link) => link.href === href) ? href : undefined,
    }
  })
  const title = links
    .find((link) => link.href === pathname)
    ?.title.toLowerCase()
  if (title && title !== segments.at(-1)) crumbs.push({ label: title })
  return crumbs
}
