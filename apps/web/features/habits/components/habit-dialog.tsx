"use client"

import { useRouter } from "next/navigation"
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import {
  DialogActions,
  ResponsiveDialog,
} from "@/components/shared/responsive-dialog"

import {
  createHabitAction,
  updateHabitAction,
  type ActionState,
} from "../actions"
import type { Habit, TimeOfDay } from "../schemas"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const TIMES: { value: TimeOfDay; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
]

/** New or edit habit (HB-1, HB-2). Edit applies a changed schedule from today on (HB-4). */
export function HabitDialog({
  habit,
  goals = [],
  defaultGoalId,
  label,
  variant = "default",
  size = "default",
}: {
  habit?: Habit
  /** Goals the habit can serve (optional). */
  goals?: { id: string; name: string }[]
  /** Preselected goal, e.g. when opened from a goal's page. */
  defaultGoalId?: string
  label: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm"
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={habit ? "Edit habit" : "New habit"}
        description="Small and specific beats ambitious. You can always change it later."
      >
        <HabitForm
          habit={habit}
          goals={goals}
          defaultGoalId={defaultGoalId}
          onDone={() => setOpen(false)}
        />
      </ResponsiveDialog>
    </>
  )
}

function HabitForm({
  habit,
  goals,
  defaultGoalId,
  onDone,
}: {
  habit?: Habit
  goals: { id: string; name: string }[]
  defaultGoalId?: string
  onDone: () => void
}) {
  const router = useRouter()
  const current = habit?.schedules.at(-1)
  const [kind, setKind] = useState<string>(current?.kind ?? "days")
  const [weekdays, setWeekdays] = useState<string[]>(
    (current?.kind === "days" ? current.weekdays : [1, 2, 3, 4, 5]).map(String)
  )
  const [timeOfDay, setTimeOfDay] = useState<string>(
    habit?.timeOfDay ?? "morning"
  )

  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = habit
        ? await updateHabitAction(habit.id, previous, formData)
        : await createHabitAction(previous, formData)
      if (result.saved) {
        onDone()
        if (!habit && result.habitId) {
          router.push(`/dashboard/habits/${result.habitId}`)
        }
      }
      return result
    },
    {}
  )

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FieldGroup className="sm:grid sm:grid-cols-2">
        {goals.length > 0 ? (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="habit-goal">
              Which goal is this for? (optional)
            </FieldLabel>
            <NativeSelect
              id="habit-goal"
              name="goalId"
              defaultValue={habit?.goalId ?? defaultGoalId ?? ""}
            >
              <NativeSelectOption value="">No goal</NativeSelectOption>
              {goals.map((goal) => (
                <NativeSelectOption key={goal.id} value={goal.id}>
                  {goal.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="habit-name">Name</FieldLabel>
          <Input
            id="habit-name"
            name="name"
            defaultValue={habit?.name}
            placeholder="Read before bed"
            maxLength={80}
            required
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="habit-cue">When…</FieldLabel>
          <Input
            id="habit-cue"
            name="cue"
            defaultValue={habit?.cue ?? ""}
            placeholder="I brush my teeth"
            maxLength={120}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="habit-minimum">Minimum version</FieldLabel>
          <Input
            id="habit-minimum"
            name="minimumVersion"
            defaultValue={habit?.minimumVersion ?? ""}
            placeholder="Read one page"
            maxLength={60}
          />
          <FieldDescription>What counts on a low-energy day.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="habit-full">Full version</FieldLabel>
          <Input
            id="habit-full"
            name="fullVersion"
            defaultValue={habit?.fullVersion ?? ""}
            placeholder="Read for 20 minutes"
            maxLength={60}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel>Repeat</FieldLabel>
          <ToggleGroup
            aria-label="Repeat"
            value={[kind]}
            onValueChange={(value) => value[0] && setKind(value[0])}
            variant="outline"
            spacing={0}
          >
            <ToggleGroupItem value="days">On days</ToggleGroupItem>
            <ToggleGroupItem value="every">Every few days</ToggleGroupItem>
          </ToggleGroup>
          <input type="hidden" name="kind" value={kind} />
          {kind === "days" ? (
            <>
              <ToggleGroup
                aria-label="Days of the week"
                multiple
                value={weekdays}
                onValueChange={setWeekdays}
                variant="outline"
                spacing={0}
                className="flex-wrap"
              >
                {DAY_LABELS.map((day, index) => (
                  <ToggleGroupItem key={day} value={String(index)}>
                    {day}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {weekdays.map((day) => (
                <input key={day} type="hidden" name="weekdays" value={day} />
              ))}
            </>
          ) : (
            <NativeSelect
              name="everyN"
              defaultValue={String(
                current?.kind === "every" ? current.everyN : 2
              )}
              aria-label="Every how many days"
            >
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <NativeSelectOption key={n} value={n}>
                  Every {n} days
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field>
          <FieldLabel>Time of day</FieldLabel>
          <ToggleGroup
            aria-label="Time of day"
            value={[timeOfDay]}
            onValueChange={(value) => value[0] && setTimeOfDay(value[0])}
            variant="outline"
            spacing={0}
          >
            {TIMES.map((time) => (
              <ToggleGroupItem key={time.value} value={time.value}>
                {time.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <input type="hidden" name="timeOfDay" value={timeOfDay} />
        </Field>
      </FieldGroup>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <DialogActions>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {habit ? "Save changes" : "Create habit"}
        </Button>
      </DialogActions>
    </form>
  )
}
