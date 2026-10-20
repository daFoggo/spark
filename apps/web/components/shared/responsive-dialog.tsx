"use client"

import type { ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import { useMediaQuery } from "@/hooks/use-media-query"

const WIDTH = { md: "sm:max-w-xl", lg: "sm:max-w-3xl" } as const

/**
 * Dialog from `md` up, bottom Drawer below it (shadcn "Responsive Dialog"). The body scrolls
 * inside the drawer and inside the dialog when it is taller than the screen.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  size?: keyof typeof WIDTH
  children: ReactNode
}) {
  const desktop = useMediaQuery("(min-width: 768px)")

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`${WIDTH[size]} max-h-svh gap-6 overflow-y-auto p-6`}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** Buttons row for a form inside `ResponsiveDialog`: stacked on mobile, right-aligned from `sm`. */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  )
}
