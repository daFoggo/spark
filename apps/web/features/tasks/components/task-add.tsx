"use client"

import { useRef, useState, useTransition } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"

import { addTaskAction } from "../actions"
import { parseQuickAdd } from "../rules"

/**
 * Quick add (flow 5.5): one line, Enter to add; the list is the tab you are on. A `#goal-slug` links
 * that goal and is removed from the title; an unknown slug stays as typed (TK-3).
 */
export function TaskAdd({
  list = "today",
  placeholder = "Add a task",
  goals = [],
}: {
  list?: "today" | "later"
  placeholder?: string
  /** Goals a `#slug` can point at. */
  goals?: { id: string; slug: string }[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = inputRef.current?.value ?? ""
    const { title, goalSlug } = parseQuickAdd(
      text,
      new Set(goals.map((goal) => goal.slug))
    )
    const goalId = goals.find((goal) => goal.slug === goalSlug)?.id ?? null
    setError(undefined)
    startTransition(async () => {
      const result = await addTaskAction({ title, list, goalId })
      if (result.error) setError(result.error)
      else if (inputRef.current) inputRef.current.value = ""
    })
  }

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-2">
      <InputGroup>
        <InputGroupInput
          ref={inputRef}
          placeholder={placeholder}
          aria-label="New task"
          maxLength={220}
          required
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" disabled={pending}>
            {pending ? <Spinner /> : null}
            Add
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error ? (
        <p role="alert" className="text-diff-del">
          {error}
        </p>
      ) : null}
    </form>
  )
}
