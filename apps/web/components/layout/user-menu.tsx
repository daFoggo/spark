"use client"

import { IconUser } from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useSidebar } from "@workspace/ui/components/sidebar"

/**
 * Account row pinned to the sidebar bottom: `└`, user icon, name, role; just the icon in the icon rail
 * (where the menu opens to the side). Menu items come from the caller (composition), e.g.
 * sign out from features/auth.
 */
export function UserMenu({
  name,
  email,
  role,
  children,
}: {
  name: string
  email: string | null
  role: string
  children: React.ReactNode
}) {
  const { state, isMobile } = useSidebar()
  const iconRail = state === "collapsed" && !isMobile
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${name} [${role}]`}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-sm text-ink-2 transition-colors duration-150 group-data-[collapsible=icon]:justify-center hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"
      >
        <span
          aria-hidden
          className="text-ink-4 group-data-[collapsible=icon]:hidden"
        >
          └
        </span>
        <IconUser aria-hidden className="size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
          {name}
        </span>
        <span className="ml-auto text-xs text-ink-3 group-data-[collapsible=icon]:hidden">
          [{role}]
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={iconRail ? "right" : "top"}
        align={iconRail ? "end" : "start"}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{email ?? name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
