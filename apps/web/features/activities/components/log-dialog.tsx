"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

import { ResponsiveDialog } from "@/components/shared/responsive-dialog"

import { LogForm } from "./log-form"

/** "Log progress" as a button that opens the log form in a dialog (spec 5.2). */
export function LogDialog({
  day,
  goals = [],
  goalId,
  label = "Log progress",
  variant = "outline",
}: {
  /** The local date the log is for. */
  day: string
  goals?: { id: string; name: string }[]
  goalId?: string
  label?: string
  variant?: "default" | "outline"
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Log progress"
        description="Something you did for a goal that is not one of your habits. A line is enough."
      >
        <LogForm
          today={day}
          goals={goals}
          goalId={goalId}
          onSaved={() => setOpen(false)}
        />
      </ResponsiveDialog>
    </>
  )
}
