import Link from "next/link"

import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu"

import { AppSidebarSection } from "@/components/layout/app-sidebar"
import { NavTree } from "@/components/layout/nav-tree"
import { UserMenu } from "@/components/layout/user-menu"
import { DASHBOARD_NAV, filterNav } from "@/config/navigation"
import { ACCOUNT_PATH } from "@/config/routes"
import { SignOutMenuItem } from "@/features/auth/components/sign-out-menu-item"
import { hasPermission } from "@/lib/auth/permissions"
import { getSession } from "@/lib/dal"

/** Hides links (and whole sections) the role cannot open; pages still enforce access. */
export async function SessionNav() {
  const session = await getSession()
  if (!session) return null
  const sections = filterNav(DASHBOARD_NAV, (permission) =>
    hasPermission(session.role, permission)
  )
  return sections.map((section) => (
    <AppSidebarSection key={section.label} label={section.label}>
      <NavTree entries={section.entries} />
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
