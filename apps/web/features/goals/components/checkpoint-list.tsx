"use client"

import { useOptimistic, useState, useTransition } from "react"
import { IconArrowDown, IconArrowUp, IconX } from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Progress } from "@workspace/ui/components/progress"

import {
  addCheckpointAction,
  editCheckpointAction,
  toggleCheckpointAction,
} from "../actions"
import type { Checkpoint } from "../schemas"

/**
 * Checkpoints (CP-1…CP-4): optional steps you tick yourself. With none there is no percentage.
 * Toggling is optimistic; rename saves on blur; the arrows swap neighbours.
 */
export function CheckpointList({
  goalId,
  checkpoints,
}: {
  goalId: string
  checkpoints: Checkpoint[]
}) {
  const [done, setDone] = useOptimistic(
    new Set(checkpoints.filter((c) => c.doneOn).map((c) => c.id)),
    (current, change: { id: string; done: boolean }) => {
      const next = new Set(current)
      if (change.done) next.add(change.id)
      else next.delete(change.id)
      return next
    }
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [title, setTitle] = useState("")

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

  const total = checkpoints.length
  const doneCount = done.size

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {total > 0 ? (
        <Progress value={Math.round((doneCount / total) * 100)}>
          <span className="font-mono text-xs text-ink-3 tabular-nums">
            {doneCount}/{total}
          </span>
        </Progress>
      ) : (
        <p className="text-ink-2">
          No checkpoints. Add one when you can see the next step.
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {checkpoints.map((checkpoint, index) => (
          <li key={checkpoint.id} className="flex items-center gap-2">
            <Checkbox
              checked={done.has(checkpoint.id)}
              aria-label={`Done: ${checkpoint.title}`}
              onCheckedChange={(checked) =>
                run(
                  () =>
                    toggleCheckpointAction({
                      goalId,
                      checkpointId: checkpoint.id,
                      done: checked,
                    }),
                  () => setDone({ id: checkpoint.id, done: checked })
                )
              }
            />
            <Input
              defaultValue={checkpoint.title}
              aria-label="Checkpoint title"
              maxLength={120}
              className="min-w-0 flex-1 border-transparent bg-transparent"
              onBlur={(event) => {
                const next = event.target.value.trim()
                if (next && next !== checkpoint.title) {
                  run(() =>
                    editCheckpointAction({
                      goalId,
                      checkpointId: checkpoint.id,
                      change: { rename: next },
                    })
                  )
                } else {
                  event.target.value = checkpoint.title
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Move up"
              disabled={pending || index === 0}
              onClick={() =>
                run(() =>
                  editCheckpointAction({
                    goalId,
                    checkpointId: checkpoint.id,
                    change: { move: -1 },
                  })
                )
              }
            >
              <IconArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Move down"
              disabled={pending || index === total - 1}
              onClick={() =>
                run(() =>
                  editCheckpointAction({
                    goalId,
                    checkpointId: checkpoint.id,
                    change: { move: 1 },
                  })
                )
              }
            >
              <IconArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete: ${checkpoint.title}`}
              disabled={pending}
              onClick={() =>
                run(() =>
                  editCheckpointAction({
                    goalId,
                    checkpointId: checkpoint.id,
                    change: { remove: true },
                  })
                )
              }
            >
              <IconX />
            </Button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const next = title.trim()
          if (!next) return
          run(
            () =>
              addCheckpointAction({
                goalId,
                title: next,
                position: total,
              }),
            () => setTitle("")
          )
        }}
      >
        <InputGroup>
          <InputGroupInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a checkpoint"
            aria-label="New checkpoint"
            maxLength={120}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" disabled={pending || !title.trim()}>
              Add
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      {error ? (
        <p role="alert" className="text-diff-del">
          {error}
        </p>
      ) : null}
    </div>
  )
}
