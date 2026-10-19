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
import { cn } from "@workspace/ui/lib/utils"

import type { NavEntry, NavGroup, NavLink } from "@/config/navigation"

const row =
  "group/row flex w-full items-center gap-2 px-2 py-1.5 font-mono text-sm text-ink-2 transition-colors duration-150 hover:bg-accent hover:text-foreground"

/** Label nudges right on hover, like the claude.dev TOC (`translate-x-1`, `duration-200 ease-out`). */
function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover/row:translate-x-1">
      {children}
    </span>
  )
}

/** The large TOC of design system §8: `└` glyphs, current glyph in brand orange, two levels max. */
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
  const { setOpenMobile } = useSidebar()
  const current = pathname === link.href
  return (
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
    >
      <span
        aria-hidden
        className="text-ink-4 group-data-current/tree:text-brand"
      >
        └
      </span>
      <RowLabel>{link.title}</RowLabel>
    </Link>
  )
}

function TreeGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const id = `nav-${group.title.toLowerCase()}`
  const containsCurrent = group.items.some((item) => item.href === pathname)
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(row, containsCurrent && "text-foreground")}
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
      {open ? (
        <SidebarMenu id={id} className="pl-4">
          {group.items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <TreeLink link={item} />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      ) : null}
    </>
  )
}
