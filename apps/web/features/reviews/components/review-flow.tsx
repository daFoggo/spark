"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Progress } from "@workspace/ui/components/progress"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import { completeReviewAction } from "../actions"
import { toggleFocus } from "../rules"
import { FOCUS_LIMIT, type HabitChoice } from "../schemas"

export type ReviewHabit = {
  id: string
  name: string
  done: number
  due: number
  /** Last 14 days, 0..1, or null when nothing was due. */
  rate14: number | null
  /** RV-3: under 50% in the last 14 days. */
  suggestEasier: boolean
}

export type ReviewTask = { id: string; title: string; goalName: string | null }

export type ReviewData = {
  weekStart: string
  totals: { checkIns: string; logged: number; tasksDone: number; hours: string }
  habits: ReviewHabit[]
  tasks: ReviewTask[]
  initial: {
    reflection: string
    choices: Record<string, HabitChoice>
    focus: string[]
  }
  /** The week's review was already saved (RV-1: it can be re-opened until the week ends). */
  saved: boolean
}

const STEPS = ["Look back", "Adjust", "Next week"] as const
const CHOICES: { value: HabitChoice; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "easier", label: "Make easier" },
  { value: "pause", label: "Pause" },
]

/**
 * Weekly review (flow 5.7): three steps held in local state, written once on Finish. Everything it
 * shows arrives as props; the page reads habits, activities and tasks and passes the numbers in.
 */
export function ReviewFlow({ data }: { data: ReviewData }) {
  const [step, setStep] = useState(0)
  const [reflection, setReflection] = useState(data.initial.reflection)
  const [choices, setChoices] = useState(data.initial.choices)
  const [focus, setFocus] = useState(data.initial.focus)
  const [saved, setSaved] = useState(data.saved)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  const choiceOf = (id: string): HabitChoice => choices[id] ?? "keep"

  function finish() {
    setError(undefined)
    startTransition(async () => {
      const result = await completeReviewAction({
        weekStart: data.weekStart,
        reflection,
        choices,
        focusTaskIds: focus,
      })
      if (result.error) setError(result.error)
      else setSaved(true)
    })
  }

  if (saved) {
    const easier = data.habits.filter((h) => choiceOf(h.id) === "easier")
    const paused = data.habits.filter((h) => choiceOf(h.id) === "pause")
    return (
      <section className="flex max-w-2xl flex-col gap-5">
        <p role="status" className="text-2xl font-medium">
          Review saved.
        </p>
        <p className="text-ink-2">
          {focus.length} focus {focus.length === 1 ? "task" : "tasks"} for next
          week
          {paused.length > 0
            ? `, ${paused.length} ${paused.length === 1 ? "habit" : "habits"} paused from next week`
            : ""}
          . See you next week.
        </p>
        {easier.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
              Make these easier
            </span>
            <ul className="flex flex-col gap-1">
              {easier.map((habit) => (
                <li key={habit.id}>
                  <Link
                    href={`/dashboard/habits/${habit.id}`}
                    prefetch
                    className="underline-offset-4 hover:underline"
                  >
                    {habit.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <Button variant="outline" onClick={() => setSaved(false)}>
            Edit review
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="flex max-w-3xl flex-col gap-8">
      <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
        <TabsList variant="line">
          {STEPS.map((label, index) => (
            <TabsTrigger key={label} value={String(index)}>
              {index + 1}. {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {step === 0 ? (
        <div className="flex flex-col gap-8">
          <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              ["Check-ins", data.totals.checkIns],
              ["Logged", String(data.totals.logged)],
              ["Tasks done", String(data.totals.tasksDone)],
              ["Hours", data.totals.hours],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-1.5">
                <dt className="font-mono text-xs tracking-wider text-ink-3 uppercase">
                  {label}
                </dt>
                <dd className="text-2xl font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <ItemGroup role="none" className="gap-2">
            {data.habits.map((habit) => (
              <Item key={habit.id} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{habit.name}</ItemTitle>
                  <ItemDescription>
                    {habit.done} of {habit.due} scheduled days
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="w-32">
                  <Progress
                    value={
                      habit.due === 0
                        ? 0
                        : Math.round((habit.done / habit.due) * 100)
                    }
                  />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="review-reflection"
              className="font-mono text-xs tracking-wider text-ink-3 uppercase"
            >
              What got in the way?
            </label>
            <Textarea
              id="review-reflection"
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              maxLength={2000}
              placeholder="Optional. Late nights, travel, too ambitious…"
            />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-ink-2">
            Keep, make easier or pause. A pause starts next week.
          </p>
          {data.habits.length === 0 ? (
            <p className="text-ink-2">You have no habits to tune yet.</p>
          ) : (
            <ItemGroup role="none" className="gap-2">
              {data.habits.map((habit) => (
                <Item key={habit.id} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{habit.name}</ItemTitle>
                    <ItemDescription>
                      {habit.rate14 === null
                        ? "Nothing was due in the last 2 weeks"
                        : `${Math.round(habit.rate14 * 100)}% in the last 2 weeks`}
                      {habit.suggestEasier
                        ? " · Under 50% usually means it is too big. Shrink it before you drop it."
                        : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ToggleGroup
                      aria-label={`Plan for ${habit.name}`}
                      value={[choiceOf(habit.id)]}
                      onValueChange={(value) => {
                        const next = value[0] as HabitChoice | undefined
                        if (next)
                          setChoices((c) => ({ ...c, [habit.id]: next }))
                      }}
                      variant="outline"
                      spacing={0}
                    >
                      {CHOICES.map((choice) => (
                        <ToggleGroupItem
                          key={choice.value}
                          value={choice.value}
                          aria-label={`${choice.label}: ${habit.name}`}
                        >
                          {choice.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <p className="text-ink-2">
              Pick up to {FOCUS_LIMIT} tasks to focus on.
            </p>
            <span className="font-mono text-xs text-ink-3">
              {focus.length}/{FOCUS_LIMIT} chosen
            </span>
          </div>
          {data.tasks.length === 0 ? (
            <p className="text-ink-2">No open tasks. Nothing to pick.</p>
          ) : (
            <ItemGroup role="none" className="gap-2">
              {data.tasks.map((task) => {
                const chosen = focus.includes(task.id)
                return (
                  <Item key={task.id} variant="outline" size="sm">
                    <Checkbox
                      checked={chosen}
                      disabled={!chosen && focus.length >= FOCUS_LIMIT}
                      onCheckedChange={() =>
                        setFocus((current) => toggleFocus(current, task.id))
                      }
                      aria-label={`Focus: ${task.title}`}
                    />
                    <ItemContent>
                      <ItemTitle>{task.title}</ItemTitle>
                      {task.goalName ? (
                        <ItemDescription>{task.goalName}</ItemDescription>
                      ) : null}
                    </ItemContent>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-diff-del">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>Next</Button>
        ) : (
          <Button onClick={finish} disabled={pending}>
            Finish review
          </Button>
        )}
      </div>
    </section>
  )
}
