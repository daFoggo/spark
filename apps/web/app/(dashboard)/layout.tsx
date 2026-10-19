import { Suspense } from "react"
import Link from "next/link"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  AppSidebar,
  AppSidebarBody,
  AppSidebarSection,
} from "@/components/layout/app-sidebar"
import { ColumnHeader } from "@/components/layout/column-header"
import { DashboardBreadcrumb } from "@/components/layout/dashboard-breadcrumb"
import {
  SidebarCommand,
  ThemeCommand,
} from "@/components/layout/header-commands"
import { MainHeaderStart } from "@/components/layout/main-header-start"
import { Stagger } from "@/components/shared/stagger"
import { AppLogo } from "@/components/shared/app-logo"
import { DASHBOARD_NAV } from "@/config/navigation"

import { SessionAccount, SessionNav } from "./_components/session-nav"

/**
 * Dashboard shell (design system §8): sidebar column + main column, each a ColumnHeader over a
 * scrolling body. The static frame prerenders; session-dependent parts stream in <Suspense>.
 * No authorization here: pages call `requirePermission` next to their data.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar>
        <ColumnHeader className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link href="/">
            <AppLogo textClassName="group-data-[collapsible=icon]:hidden" />
          </Link>
        </ColumnHeader>
        <AppSidebarBody>
          {/* One AppSidebarSection per nav section (config/navigation.ts). */}
          <Suspense fallback={<NavSkeleton />}>
            <SessionNav />
          </Suspense>
          <AppSidebarSection label="Account" pinned>
            <Suspense fallback={<Skeleton className="h-8" />}>
              <SessionAccount />
            </Suspense>
          </AppSidebarSection>
        </AppSidebarBody>
      </AppSidebar>
      <SidebarInset>
        <div className="flex h-svh min-w-0 flex-col">
          <ColumnHeader>
            <MainHeaderStart>
              <DashboardBreadcrumb sections={DASHBOARD_NAV} />
            </MainHeaderStart>
            <div className="ml-auto flex shrink-0 items-center gap-4">
              <SidebarCommand className="max-md:hidden" />
              <ThemeCommand />
            </div>
          </ColumnHeader>
          <div className="no-scrollbar flex-1 overflow-y-auto">
            <Stagger className="flex flex-col gap-8 px-4 pt-10 pb-14 sm:px-8">
              {children}
            </Stagger>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// Not SidebarMenuSkeleton: its random widths (Math.random) are not allowed while prerendering.
function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
    </div>
  )
}
