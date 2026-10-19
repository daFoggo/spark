import {
  Sidebar,
  SidebarContent,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Spark sidebar composed from the shadcn primitives, which stay untouched for future upgrades:
 * shadcn provides collapse, the mobile Sheet and the keyboard shortcut; these parts provide the
 * design-system layout. It collapses to a 48px icon rail (`collapsible="icon"`) instead of
 * disappearing, so every page stays one click away; the rail edge also toggles it on click.
 */
export function AppSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      {children}
      <SidebarRail />
    </Sidebar>
  )
}

/** Scrolling body under the header cell. */
export function AppSidebarBody({ children }: { children: React.ReactNode }) {
  return (
    <SidebarContent>
      <div className="flex flex-1 flex-col gap-8 px-4 py-6 group-data-[collapsible=icon]:gap-4 group-data-[collapsible=icon]:px-2">
        {children}
      </div>
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
    <section
      className={cn(
        "flex flex-col gap-2 group-data-[collapsible=icon]:not-first:border-t group-data-[collapsible=icon]:not-first:pt-4",
        pinned && "mt-auto"
      )}
    >
      {/* The label gives way to a hairline between sections in the icon rail. */}
      <h2 className="px-2 font-mono text-xs tracking-wider text-ink-3 uppercase group-data-[collapsible=icon]:hidden">
        {label}
      </h2>
      {children}
    </section>
  )
}
