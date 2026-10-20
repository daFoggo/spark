"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"

import { breadcrumbTrail, type NavSection } from "@/config/navigation"

/** Renders `breadcrumbTrail`; below sm only the current page stays visible. */
export function DashboardBreadcrumb({
  sections,
  labels,
}: {
  sections: NavSection[]
  /** Names for record ids in the URL. */
  labels?: Record<string, string>
}) {
  const pathname = usePathname()
  const crumbs = breadcrumbTrail(pathname, sections, labels)
  return (
    <Breadcrumb className="min-w-0 font-mono">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          if (last) {
            return (
              <BreadcrumbItem key={index} className="min-w-0">
                <BreadcrumbPage className="truncate">
                  {crumb.label}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )
          }
          return (
            <Fragment key={index}>
              <BreadcrumbItem className="max-sm:hidden">
                {crumb.href ? (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  crumb.label
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-ink-4 max-sm:hidden">
                /
              </BreadcrumbSeparator>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
