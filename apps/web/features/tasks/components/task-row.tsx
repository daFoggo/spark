"use client"

import { useOptimistic, useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  dropTaskAction,
  logTaskAction,
  moveTaskAction,
  saveTaskNoteAction,
  toggleTaskAction,
} from "../actions"

export type TaskRowData = {
  id: string
  title: string
  note: string | null
  goalId: string | null
  /** Name of the linked goal, when there is one. */
  goalName: string | null
  done: boolean
  list: "today" | "later"
  /** Days carried over (TK-4). */
  age: number
  /** TK-5: asks "Still want to do this?". */
  stale: boolean
}

/** One task (flow 5.5): toggle, carry-over age, stale prompt, note, and the one-time "Add to log?" offer. */
export function TaskRow({ task, today }: { task: TaskRowData; today: string }) {
  const [done, setDone] = useOptimistic(
    task.done,
    (_current, next: boolean) => next
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [offerLog, setOfferLog] = useState(false)
  const [noteOpen, setNoteOpen] = useState(Boolean(task.note))

  function run(
    work: () => Promise<{ error?: string }>,
    optimistic?: () => void
  ) {
    setError(undefined)
    startTransition(async () => {
      optimistic?.()
      const result = await work()
      if (result.error) setError(result.error)
    })
  }

  function toggle() {
    const next = !done
    setError(undefined)
    startTransition(async () => {
      setDone(next)
      const result = await toggleTaskAction({ taskId: task.id, done: next })
      if ("error" in result) {
        setError(result.error)
        return
      }
      // TK-6: the offer shows once, right after completing a goal-linked task.
      setOfferLog(next && task.goalId !== null)
    })
  }

  return (
    <Item variant="outline" size="sm" className="items-start">
      <Checkbox
        checked={done}
        onCheckedChange={toggle}
        aria-label={`Done: ${task.title}`}
        className="mt-0.5"
      />
      <ItemContent>
        <ItemTitle className={done ? "text-ink-3 line-through" : undefined}>
          {task.title}
        </ItemTitle>
        {task.goalName || (!done && task.age > 0) ? (
          <ItemDescription>
            {[
              task.goalName,
              !done && task.age > 0
                ? `Carried over · ${task.age} ${task.age === 1 ? "day" : "days"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        {task.list === "later" && !done ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => moveTaskAction({ taskId: task.id, to: "today", today }))
            }
          >
            Move to today
          </Button>
        ) : null}
        <Button
          type="button"
          size="xs"
          variant="ghost"
          aria-expanded={noteOpen}
          onClick={() => setNoteOpen((open) => !open)}
        >
          Note
        </Button>
      </ItemActions>
      {noteOpen ? (
        <ItemFooter>
          <Textarea
            defaultValue={task.note ?? ""}
            maxLength={2000}
            placeholder="Add a note"
            aria-label={`Note for ${task.title}`}
            onBlur={(event) => {
              const note = event.target.value
              if (note.trim() !== (task.note ?? "")) {
                run(() => saveTaskNoteAction({ taskId: task.id, note }))
              }
            }}
          />
        </ItemFooter>
      ) : null}
      {task.stale && !done ? (
        <ItemFooter className="flex-wrap gap-2">
          <span className="text-ink-2">Still want to do this?</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => moveTaskAction({ taskId: task.id, to: "keep", today }))
            }
          >
            Keep
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => moveTaskAction({ taskId: task.id, to: "later", today }))
            }
          >
            Later
          </Button>
          <Button
            type="button"
            size="xs"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => dropTaskAction(task.id))}
          >
            Drop
          </Button>
        </ItemFooter>
      ) : null}
      {offerLog && done ? (
        <ItemFooter className="flex-wrap gap-2">
          <span className="text-ink-2">Add to log?</span>
          <Button
            type="button"
            size="xs"
            disabled={pending}
            onClick={() => {
              setOfferLog(false)
              run(() => logTaskAction(task.id))
            }}
          >
            Add
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setOfferLog(false)}
          >
            No thanks
          </Button>
        </ItemFooter>
      ) : null}
      {error ? (
        <ItemFooter role="alert" className="text-diff-del">
          {error}
        </ItemFooter>
      ) : null}
    </Item>
  )
}
