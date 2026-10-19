"use client"

import { useState, useTransition } from "react"
import { IconX } from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"

import { deleteActivityAction } from "../actions"

export type LogEntry = {
  id: number
  /** "Mon, Oct 19". */
  day: string
  note: string
  meta: string
}

/** Recent free logs with a delete button each (AC-9). */
export function LogList({ entries }: { entries: LogEntry[] }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  function remove(id: number) {
    setError(undefined)
    startTransition(async () => {
      const result = await deleteActivityAction(id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <ItemGroup className="gap-2">
        {entries.map((entry) => (
          <Item key={entry.id} variant="muted" size="xs">
            <ItemContent>
              <ItemTitle>{entry.note}</ItemTitle>
              <ItemDescription>
                {entry.day}
                {entry.meta ? ` · ${entry.meta}` : ""}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete: ${entry.note}`}
                disabled={pending}
                onClick={() => remove(entry.id)}
              >
                <IconX />
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {error ? (
        <p role="alert" className="text-diff-del">
          {error}
        </p>
      ) : null}
    </div>
  )
}
