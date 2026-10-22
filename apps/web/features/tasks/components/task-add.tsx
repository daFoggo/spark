"use client"

import { IconTarget } from "@tabler/icons-react"
import { useRef, useState, useTransition } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"

import { addTaskAction } from "../actions"
import { parseQuickAdd } from "../rules"

type GoalOption = { id: string; slug: string; name: string }

/** The `#word` being typed at the end of the line, without the `#`. */
const TRAILING_TAG = /(?:^|\s)#([a-z0-9-]*)$/i

/**
 * Quick add (flow 5.5): one line, Enter to add; the list is the tab you are on. Typing `#` lists
 * your goals to pick from; a `#goal-slug` links that goal and is removed from the title, an
 * unknown slug stays as typed (TK-3). The linked goal shows as a badge before you press Enter.
 */
export function TaskAdd({
  list = "today",
  placeholder = "Add a task",
  goals = [],
}: {
  list?: "today" | "later"
  placeholder?: string
  /** Goals a `#slug` can point at. */
  goals?: GoalOption[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const slugs = new Set(goals.map((goal) => goal.slug))
  const { title, goalSlug } = parseQuickAdd(text, slugs)
  const linked = goals.find((goal) => goal.slug === goalSlug)

  const typing = TRAILING_TAG.exec(text)?.[1]?.toLowerCase()
  const suggestions =
    typing === undefined
      ? []
      : goals
          .filter(
            (goal) =>
              goal.slug.includes(typing) ||
              goal.name.toLowerCase().includes(typing)
          )
          .slice(0, 4)

  function pick(goal: GoalOption) {
    setText((current) =>
      current.replace(
        TRAILING_TAG,
        (m) => `${m.startsWith("#") ? "" : m[0]}#${goal.slug} `
      )
    )
    inputRef.current?.focus()
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const goalId = linked?.id ?? null
    setError(undefined)
    startTransition(async () => {
      const result = await addTaskAction({ title, list, goalId })
      if (result.error) setError(result.error)
      else setText("")
    })
  }

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-2">
      <InputGroup>
        <InputGroupInput
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter completes the first suggestion instead of adding a half-typed `#tag`.
            const first = suggestions[0]
            if (event.key === "Enter" && first && !slugs.has(typing ?? "")) {
              event.preventDefault()
              pick(first)
            }
          }}
          placeholder={
            goals.length > 0 ? `${placeholder} · # links a goal` : placeholder
          }
          aria-label="New task"
          maxLength={220}
          required
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Add
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {suggestions.length > 0 ? (
        <div
          role="group"
          aria-label="Goals to link"
          className="flex flex-wrap gap-2"
        >
          {suggestions.map((goal) => (
            <Button
              key={goal.id}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => pick(goal)}
            >
              <IconTarget aria-hidden data-icon="inline-start" />
              {goal.name}
            </Button>
          ))}
        </div>
      ) : null}
      {linked ? (
        <p role="status" className="flex items-center gap-2 text-ink-2">
          Linked to <Badge variant="outline">{linked.name}</Badge>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-diff-del">
          {error}
        </p>
      ) : null}
    </form>
  )
}
