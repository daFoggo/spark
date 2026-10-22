"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { IconDots } from "@tabler/icons-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { HABITS_PATH } from "@/config/routes"

import {
  archiveHabitAction,
  pauseHabitAction,
  resumeHabitAction,
} from "../actions"

/** Pause / resume / archive for the habit page (HB-5, HB-6). Archiving asks first. */
export function HabitMenu({
  habitId,
  today,
  paused,
}: {
  habitId: string
  today: string
  paused: boolean
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  function run(task: () => Promise<{ error?: string }>, after?: () => void) {
    setError(undefined)
    startTransition(async () => {
      const result = await task()
      if (result.error) setError(result.error)
      else after?.()
    })
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-diff-del">{error}</span> : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Habit actions"
              disabled={pending}
            />
          }
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {paused ? (
            <DropdownMenuItem
              onClick={() => run(() => resumeHabitAction({ habitId, today }))}
            >
              Resume
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  pauseHabitAction({ habitId, from: today, until: null })
                )
              }
            >
              Pause
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setConfirming(true)}>
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this habit?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves Today and your lists. Past check-ins stay and still
              count toward your goals and your pet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(
                  () => archiveHabitAction(habitId),
                  () => router.push(HABITS_PATH)
                )
              }
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
