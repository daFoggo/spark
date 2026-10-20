import { DashboardBreadcrumb } from "@/components/layout/dashboard-breadcrumb"
import { DASHBOARD_NAV } from "@/config/navigation"
import { getGoals } from "@/features/goals/queries"
import { getHabits } from "@/features/habits/queries"
import { requirePermission } from "@/lib/dal"

/**
 * Breadcrumb with record names: an id in the URL (`/habits/<uuid>`) shows the habit's or goal's
 * name. Both lists are per-user cached reads the sidebar and pages already use, so this adds no
 * request; a rename shows at once because their cache tags are invalidated.
 */
export async function DashboardCrumbs() {
  await requirePermission("dashboard:view")
  const [habits, goals] = await Promise.all([getHabits(), getGoals()])
  const labels: Record<string, string> = {}
  for (const habit of habits) labels[habit.id] = habit.name
  for (const goal of goals) labels[goal.id] = goal.name
  return <DashboardBreadcrumb sections={DASHBOARD_NAV} labels={labels} />
}
