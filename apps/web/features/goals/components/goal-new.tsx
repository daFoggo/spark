"use client"

import { useRouter } from "next/navigation"
import { useActionState, useRef } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"

import { GOALS_PATH } from "@/config/routes"

import { createGoalAction, type GoalState } from "../actions"

/** A goal from just a name (GL-1). With 3 active goals it lands in Someday and says so (GL-3). */
export function GoalNew() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    async (previous: GoalState, formData: FormData) => {
      const result = await createGoalAction(previous, formData)
      if (result.saved) {
        formRef.current?.reset()
        // A goal that went to Someday stays on the list so the notice below is seen.
        if (result.goalId && !result.someday) {
          router.push(`${GOALS_PATH}/${result.goalId}`)
        }
      }
      return result
    },
    {}
  )

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex max-w-3xl flex-col gap-2"
    >
      <InputGroup>
        <InputGroupInput
          name="name"
          placeholder="New goal, just a name"
          aria-label="New goal"
          maxLength={120}
          required
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Add
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {state.error ? (
        <p role="alert" className="text-diff-del">
          {state.error}
        </p>
      ) : null}
      {state.saved && state.someday ? (
        <p role="status" className="text-ink-2">
          You already have 3 active goals, so this one is in Someday. Move one
          there to make room.
        </p>
      ) : null}
    </form>
  )
}
