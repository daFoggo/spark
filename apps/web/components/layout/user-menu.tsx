"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

/**
 * Account row pinned to the sidebar bottom: `└ name  role`.
 * Menu items come from the caller (composition), e.g. sign out from features/auth.
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-sm text-ink-2 transition-colors duration-150 hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground">
        <span aria-hidden className="text-ink-4">
          └
        </span>
        <span className="min-w-0 truncate">{name}</span>
        <span className="ml-auto text-xs text-ink-3">{role}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{email ?? name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
