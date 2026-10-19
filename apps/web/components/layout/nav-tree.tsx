"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconChevronDown } from "@tabler/icons-react"

import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import type { NavEntry, NavGroup, NavLink } from "@/config/navigation"

import { NavIcon } from "./nav-icons"

// `group-data-[collapsible=icon]` is the sidebar's 48px icon rail: rows keep only their icon.
const row =
  "group/row flex w-full items-center gap-2 px-2 py-1.5 font-mono text-sm text-ink-2 transition-colors duration-150 hover:bg-accent hover:text-foreground group-data-[collapsible=icon]:justify-center"

/** Label nudges right on hover, like the claude.dev TOC (`translate-x-1`, `duration-200 ease-out`). */
function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="group-data-[collapsible=icon]:hidden motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover/row:translate-x-1">
      {children}
    </span>
  )
}

/**
 * The large TOC of design system §8: `└` glyph, icon and label per link, the glyph in brand orange
 * for the current page; groups indent, two levels max. Only the icon stays when the sidebar
 * collapses to its icon rail (and then it carries the orange instead).
 */
export function NavTree({ entries }: { entries: NavEntry[] }) {
  return (
    <SidebarMenu>
      {entries.map((entry) => (
        <SidebarMenuItem key={entry.title}>
          {"items" in entry ? (
            <TreeGroup group={entry} />
          ) : (
            <TreeLink link={entry} />
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function TreeLink({ link }: { link: NavLink }) {
  const pathname = usePathname()
  const { setOpenMobile, state, isMobile } = useSidebar()
  const current = pathname === link.href
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={link.href}
            aria-current={current ? "page" : undefined}
            data-current={current || undefined}
            // The mobile sidebar is a Sheet: close it once the user picks a page.
            onClick={() => setOpenMobile(false)}
            className={cn(
              row,
              "group/tree data-current:font-medium data-current:text-foreground"
            )}
          />
        }
      >
        <span
          aria-hidden
          className="text-ink-4 group-data-current/tree:text-brand group-data-[collapsible=icon]:hidden"
        >
          └
        </span>
        <span className="flex text-ink-3 transition-colors duration-150 group-hover/row:text-ink-2 group-data-current/tree:text-foreground group-data-current/tree:group-data-[collapsible=icon]:text-brand">
          <NavIcon name={link.icon} />
        </span>
        <RowLabel>{link.title}</RowLabel>
      </TooltipTrigger>
      {/* Names the icon; only while the sidebar is the icon rail (same rule as SidebarMenuButton). */}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
      >
        {link.title}
      </TooltipContent>
    </Tooltip>
  )
}

function TreeGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const id = `nav-${group.title.toLowerCase()}`
  const containsCurrent = group.items.some((item) => item.href === pathname)
  return (
    <>
      {/* The icon rail has no room for a group header: its links show flat instead. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          row,
          "group-data-[collapsible=icon]:hidden",
          containsCurrent && "text-foreground"
        )}
      >
        <span aria-hidden className="text-ink-4">
          └
        </span>
        <RowLabel>{group.title}</RowLabel>
        <IconChevronDown
          aria-hidden
          className={cn(
            "ml-auto size-4 text-ink-3 motion-safe:transition-transform motion-safe:duration-300",
            !open && "-rotate-90"
          )}
        />
      </button>
      <SidebarMenu
        id={id}
        className={cn(
          "pl-4 group-data-[collapsible=icon]:pl-0",
          !open && "hidden group-data-[collapsible=icon]:flex"
        )}
      >
        {group.items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <TreeLink link={item} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </>
  )
}
