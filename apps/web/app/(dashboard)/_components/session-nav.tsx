import Link from "next/link"

import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu"

import { AppSidebarSection } from "@/components/layout/app-sidebar"
import { NavTree } from "@/components/layout/nav-tree"
import { UserMenu } from "@/components/layout/user-menu"
import { DASHBOARD_NAV, filterNav } from "@/config/navigation"
import { ACCOUNT_PATH, REVIEW_PATH } from "@/config/routes"
import { SignOutMenuItem } from "@/features/auth/components/sign-out-menu-item"
import { hasPermission } from "@/lib/auth/permissions"
import { getReview } from "@/features/reviews/queries"
import { isReviewDue } from "@/features/reviews/rules"
import { getCalendar } from "@/features/settings/queries"
import { getToday } from "@/lib/clock"
import { getSession } from "@/lib/dal"
import { startOfWeek } from "@/lib/dates"

/** RV-5: the review link says "due" until this week's review is saved. */
async function isReviewLinkDue(): Promise<boolean> {
  const calendar = await getCalendar()
  const today = await getToday(calendar.timezone)
  const weekStart = startOfWeek(today, calendar.weekStart)
  const review = await getReview(weekStart)
  return isReviewDue(review, today, weekStart)
}

/** Hides links (and whole sections) the role cannot open; pages still enforce access. */
export async function SessionNav() {
  const session = await getSession()
  if (!session) return null
  const sections = filterNav(DASHBOARD_NAV, (permission) =>
    hasPermission(session.role, permission)
  )
  const reviewDue = hasPermission(session.role, "dashboard:view")
    ? await isReviewLinkDue()
    : false
  return sections.map((section) => (
    <AppSidebarSection key={section.label} label={section.label}>
      <NavTree
        entries={section.entries.map((entry) =>
          !("items" in entry) && entry.href === REVIEW_PATH && reviewDue
            ? { ...entry, badge: "due" }
            : entry
        )}
      />
    </AppSidebarSection>
  ))
}

export async function SessionAccount() {
  const session = await getSession()
  if (!session) return null
  return (
    <UserMenu
      name={session.name ?? session.email ?? "Account"}
      email={session.email}
      role={session.role}
    >
      <DropdownMenuItem render={<Link href={ACCOUNT_PATH} />}>
        Account settings
      </DropdownMenuItem>
      <SignOutMenuItem />
    </UserMenu>
  )
}
