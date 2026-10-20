"use client"

import { useActionState, useRef } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"

import { logActivityAction, type LogState } from "../actions"

/** Free log (flow 5.2): one line about what you did, optionally with hours. Resets after saving. */
export function LogForm({
  today,
  goals = [],
  goalId,
  onSaved,
}: {
  today: string
  /** Goals the log can be linked to (optional). Ignored when `goalId` fixes the goal. */
  goals?: { id: string; name: string }[]
  /** Preset on a goal page: the log always belongs to this goal. */
  goalId?: string
  /** Called after a log is saved, e.g. to close the dialog that holds the form. */
  onSaved?: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    async (previous: LogState, formData: FormData) => {
      const result = await logActivityAction(today, previous, formData)
      if (result.saved) {
        formRef.current?.reset()
        onSaved?.()
      }
      return result
    },
    {}
  )

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex max-w-2xl flex-col gap-2"
    >
      <InputGroup>
        <InputGroupInput
          name="note"
          placeholder="What did you do today?"
          aria-label="What did you do"
          maxLength={280}
          required
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" disabled={pending}>
            {pending ? <Spinner /> : null}
            Log it
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex gap-2">
        <Input
          name="hours"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          max="24"
          placeholder="Hours"
          aria-label="Hours"
          className="w-28"
        />
        {goalId ? (
          <input type="hidden" name="goalId" value={goalId} />
        ) : goals.length > 0 ? (
          <NativeSelect name="goalId" aria-label="Goal" defaultValue="">
            <NativeSelectOption value="">No goal</NativeSelectOption>
            {goals.map((goal) => (
              <NativeSelectOption key={goal.id} value={goal.id}>
                {goal.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
        <Input
          name="topic"
          placeholder="Topic (optional)"
          aria-label="Topic"
          maxLength={40}
          className="min-w-0 flex-1"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-diff-del">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
