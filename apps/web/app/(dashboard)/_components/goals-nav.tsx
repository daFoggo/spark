import { AppSidebarSection } from "@/components/layout/app-sidebar"
import { NavTree } from "@/components/layout/nav-tree"
import type { NavLink } from "@/config/navigation"
import { getGoals } from "@/features/goals/queries"
import { requirePermission } from "@/lib/dal"

const link = (title: string, id: string): NavLink => ({
  title,
  href: `/dashboard/goals/${id}`,
  icon: "goals",
  permission: "dashboard:view",
})

/**
 * "I'm becoming" lists the active goals that have an identity (`becoming`); "Someday" lists the goals
 * on hold. Both are shortcuts to goal pages and hide when empty.
 */
export async function GoalsNav() {
  await requirePermission("dashboard:view")
  const goals = await getGoals()
  const becoming = goals.filter((g) => g.status === "active" && g.becoming)
  const someday = goals.filter((g) => g.status === "someday")

  return (
    <>
      {becoming.length > 0 ? (
        <AppSidebarSection label="I'm becoming">
          <NavTree
            entries={becoming.map((g) => link(g.becoming ?? g.name, g.id))}
          />
        </AppSidebarSection>
      ) : null}
      {someday.length > 0 ? (
        <AppSidebarSection label="Someday">
          <NavTree entries={someday.map((g) => link(g.name, g.id))} />
        </AppSidebarSection>
      ) : null}
    </>
  )
}
