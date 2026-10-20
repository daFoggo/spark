"use client"

import { createContext, useCallback, useContext, useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@workspace/ui/components/sheet"

import { useHotkey } from "@/hooks/use-hotkey"
import { useMediaQuery } from "@/hooks/use-media-query"

import { ColumnHeader } from "./column-header"
import { HeaderCommand } from "./header-commands"

/**
 * Inspector (design system §8): context for the page, never a route. A fixed column from `xl`,
 * toggled with `[I]`; below `xl` the same content opens as a right Sheet.
 */
type InspectorState = {
  /** Column open (xl and up). */
  open: boolean
  /** Sheet open (below xl). */
  sheetOpen: boolean
  wide: boolean
  toggle: () => void
  close: () => void
}

const InspectorContext = createContext<InspectorState | null>(null)

function useInspector() {
  const state = useContext(InspectorContext)
  if (!state)
    throw new Error("Inspector parts must sit inside InspectorProvider")
  return state
}

export function InspectorProvider({ children }: { children: React.ReactNode }) {
  const wide = useMediaQuery("(min-width: 80rem)")
  // The column starts open (it is part of the prerendered frame); the sheet starts closed.
  const [open, setOpen] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  const toggle = useCallback(() => {
    if (wide) setOpen((value) => !value)
    else setSheetOpen((value) => !value)
  }, [wide])
  const close = useCallback(() => {
    setOpen(false)
    setSheetOpen(false)
  }, [])

  return (
    <InspectorContext.Provider value={{ open, sheetOpen, wide, toggle, close }}>
      {children}
    </InspectorContext.Provider>
  )
}

/** `[I] INSPECTOR` in the main header. */
export function InspectorCommand({ className }: { className?: string }) {
  const { open, sheetOpen, wide, toggle } = useInspector()
  useHotkey("i", toggle)
  return (
    <HeaderCommand
      hotkey="i"
      label="Inspector"
      pressed={wide ? open : sheetOpen}
      onClick={toggle}
      className={className}
    />
  )
}

/** The panel itself: `title` in the header cell, `[ESC]` closes, `children` is the body. */
export function InspectorPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const { open, sheetOpen, wide, close } = useInspector()
  useHotkey("escape", close)

  return (
    <>
      {open ? (
        <aside
          aria-label="Inspector"
          className="hidden h-svh w-80 shrink-0 flex-col border-l xl:flex"
        >
          <ColumnHeader className="justify-between">
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
              {title}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close inspector [ESC]"
              className="font-mono text-xs text-ink-3 transition-colors duration-150 hover:text-foreground"
            >
              [ESC]
            </button>
          </ColumnHeader>
          <div className="no-scrollbar flex flex-1 flex-col gap-8 overflow-y-auto p-6">
            {children}
          </div>
        </aside>
      ) : null}
      <Sheet
        open={!wide && sheetOpen}
        onOpenChange={(next) => !next && close()}
      >
        <SheetContent side="right" className="w-full sm:max-w-80">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">
            Context for the current page
          </SheetDescription>
          <ColumnHeader>
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
              {title}
            </span>
          </ColumnHeader>
          <div className="no-scrollbar flex flex-1 flex-col gap-8 overflow-y-auto p-6">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
