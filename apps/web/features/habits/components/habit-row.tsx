"use client"

import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@workspace/ui/components/item"

import { HeatStrip, type HeatCell } from "@/components/shared/heatmap"

import { checkInAction, checkInNoteAction } from "../actions"
import type { CheckInLevel } from "../schemas"
import { HABITS_PATH } from "@/config/routes"

export type HabitRowData = {
  id: string
  name: string
  cue: string | null
  minimumVersion: string | null
  /** Name of the goal the habit serves, if any. */
  goalName: string | null
  streak: number
  /** Today's check-in, or null. */
  level: CheckInLevel | null
  /** Last 7 days, oldest first. */
  strip: HeatCell[]
}

/**
 * One habit on Today (flow 5.1). The row toggles optimistically (AC-3); the server answers with the
 * resulting level and the page re-reads. A failure reverts the row and shows the reason inline.
 */
export function HabitRow({
  habit,
  date,
  extra = false,
}: {
  habit: HabitRowData
  /** The local date being checked in. */
  date: string
  /** A habit that is not scheduled today: the check-in is an extra session (AC-4). */
  extra?: boolean
}) {
  const [level, setLevel] = useOptimistic(
    habit.level,
    (_current, next: CheckInLevel | null) => next
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [noteOpen, setNoteOpen] = useState(false)

  function tap(target: CheckInLevel) {
    setError(undefined)
    startTransition(async () => {
      // AC-3: same level undoes, another level changes it.
      setLevel(level === target ? null : target)
      const result = await checkInAction({
        habitId: habit.id,
        date,
        level: target,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      setNoteOpen(result.level !== null)
    })
  }

  return (
    <Item variant="outline" size="sm" className="items-start">
      <Checkbox
        checked={level !== null}
        indeterminate={level === "minimum"}
        onCheckedChange={() => tap("full")}
        aria-label={`Check in: ${habit.name}`}
        className="mt-0.5"
      />
      <ItemContent>
        <ItemTitle>
          <Link
            href={`${HABITS_PATH}/${habit.id}`}
            prefetch
            className="hover:underline"
          >
            {habit.name}
          </Link>
        </ItemTitle>
        <ItemDescription>
          {extra ? "Extra session · " : ""}
          {habit.goalName ? `${habit.goalName} · ` : ""}
          {habit.cue ? `When ${habit.cue}` : "No trigger yet"}
          {habit.streak > 0 ? ` · ${habit.streak} in a row` : ""}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <HeatStrip cells={habit.strip} className="max-sm:hidden" />
        {habit.minimumVersion ? (
          <Button
            type="button"
            size="xs"
            variant={level === "minimum" ? "default" : "outline"}
            aria-pressed={level === "minimum"}
            onClick={() => tap("minimum")}
            disabled={pending}
            title={habit.minimumVersion}
          >
            Minimum
          </Button>
        ) : null}
      </ItemActions>
      {error ? (
        <ItemFooter role="alert" className="text-diff-del">
          {error}
        </ItemFooter>
      ) : null}
      {noteOpen && level !== null ? (
        <ItemFooter>
          <NotePrompt
            habitId={habit.id}
            date={date}
            onDone={() => setNoteOpen(false)}
          />
        </ItemFooter>
      ) : null}
    </Item>
  )
}

/** AC-8: optional note right after checking in; skippable. */
function NotePrompt({
  habitId,
  date,
  onDone,
}: {
  habitId: string
  date: string
  onDone: () => void
}) {
  const [note, setNote] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  function save() {
    startTransition(async () => {
      const result = await checkInNoteAction({ habitId, date, note })
      if (result.error) setError(result.error)
      else onDone()
    })
  }

  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={280}
        placeholder="Add a note (optional)"
        aria-label="Note"
        className="min-w-0 flex-1"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={pending || !note.trim()}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Skip
      </Button>
      {error ? <span className="w-full text-diff-del">{error}</span> : null}
    </form>
  )
}
