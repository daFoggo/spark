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
 * "Goals" lists every active goal (its identity, "I'm becoming ...", when it has one, else its name);
 * "Someday" lists the goals on hold. Both are shortcuts to goal pages and hide when empty.
 */
export async function GoalsNav() {
  await requirePermission("dashboard:view")
  const goals = await getGoals()
  const active = goals.filter((g) => g.status === "active")
  const someday = goals.filter((g) => g.status === "someday")

  return (
    <>
      {active.length > 0 ? (
        <AppSidebarSection label="Active goals">
          <NavTree
            entries={active.map((g) => link(g.becoming ?? g.name, g.id))}
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
