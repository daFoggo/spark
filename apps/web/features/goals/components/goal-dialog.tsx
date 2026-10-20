"use client"

import { useActionState, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  DialogActions,
  ResponsiveDialog,
} from "@/components/shared/responsive-dialog"
import { updateGoalAction, type GoalState } from "../actions"
import type { Goal } from "../schemas"

/** Edit a goal's details (GL-1). Everything but the name is optional. */
export function GoalDialog({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit details
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Edit goal"
        description="A name is enough. Add the rest when it helps."
      >
        <GoalForm goal={goal} onDone={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  )
}

function GoalForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (previous: GoalState, formData: FormData) => {
      const result = await updateGoalAction(goal.id, previous, formData)
      if (result.saved) onDone()
      return result
    },
    {}
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup className="sm:grid sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="goal-name">Name</FieldLabel>
          <Input
            id="goal-name"
            name="name"
            defaultValue={goal.name}
            maxLength={120}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="goal-becoming">I&apos;m becoming</FieldLabel>
          <Input
            id="goal-becoming"
            name="becoming"
            defaultValue={goal.becoming ?? ""}
            placeholder="an AI engineer"
            maxLength={60}
          />
          <FieldDescription>Shows in the sidebar.</FieldDescription>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="goal-why">Why it matters</FieldLabel>
          <Textarea
            id="goal-why"
            name="why"
            defaultValue={goal.why ?? ""}
            maxLength={500}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="goal-target">Target date</FieldLabel>
          <Input
            id="goal-target"
            name="targetDate"
            type="date"
            defaultValue={goal.targetDate ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="goal-obstacle">If it gets hard</FieldLabel>
          <Input
            id="goal-obstacle"
            name="ifHardObstacle"
            defaultValue={goal.ifHardObstacle ?? ""}
            placeholder="I get tired after work"
            maxLength={280}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="goal-plan">Then I will</FieldLabel>
          <Input
            id="goal-plan"
            name="ifHardPlan"
            defaultValue={goal.ifHardPlan ?? ""}
            placeholder="do the 10-minute version"
            maxLength={280}
          />
        </Field>
      </FieldGroup>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <DialogActions>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Save changes
        </Button>
      </DialogActions>
    </form>
  )
}
