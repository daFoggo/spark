"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

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

import { GOALS_PATH } from "@/config/routes"

import { setGoalStatusAction } from "../actions"
import type { GoalStatus } from "../schemas"

/**
 * Status buttons for a goal (GL-2…GL-5). The database refuses a 4th active goal (GL-3) and a
 * done goal with nothing to finish (GL-4); the reason is shown next to the buttons.
 */
export function GoalStatusActions({
  goalId,
  status,
  canMarkDone,
}: {
  goalId: string
  status: GoalStatus
  /** GL-4: a target date or a checkpoint exists. */
  canMarkDone: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [archiving, setArchiving] = useState(false)

  function change(next: GoalStatus, after?: () => void) {
    setError(undefined)
    startTransition(async () => {
      const result = await setGoalStatusAction({ goalId, status: next })
      if (result.error) setError(result.error)
      else after?.()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => change("someday")}
          >
            Move to Someday
          </Button>
          {canMarkDone ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => change("done")}
            >
              Mark done
            </Button>
          ) : null}
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => change("active")}
        >
          {status === "done" ? "Reopen" : "Make active"}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setArchiving(true)}
      >
        Archive
      </Button>
      {error ? (
        <span role="alert" className="text-diff-del">
          {error}
        </span>
      ) : null}
      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from your lists. Everything you logged stays, and
              linked habits and tasks keep running.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => change("archived", () => router.push(GOALS_PATH))}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
