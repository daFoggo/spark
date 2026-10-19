import { Sidebar, SidebarContent } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Spark sidebar composed from the shadcn primitives, which stay untouched for future upgrades:
 * shadcn provides collapse, the mobile Sheet and the keyboard shortcut; these parts provide the
 * design-system layout.
 */
export function AppSidebar({ children }: { children: React.ReactNode }) {
  return <Sidebar collapsible="offcanvas">{children}</Sidebar>
}

/** Scrolling body under the header cell. */
export function AppSidebarBody({ children }: { children: React.ReactNode }) {
  return (
    <SidebarContent>
      <div className="flex flex-1 flex-col gap-8 px-4 py-6">{children}</div>
    </SidebarContent>
  )
}

export function AppSidebarSection({
  label,
  pinned,
  children,
}: {
  label: string
  /** Push the section to the bottom of the sidebar (usage, account). */
  pinned?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-2", pinned && "mt-auto")}>
      <h2 className="px-2 font-mono text-xs tracking-wider text-ink-3 uppercase">
        {label}
      </h2>
      {children}
    </section>
  )
}
