"use client"

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { IconGripVertical } from "@tabler/icons-react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { setGoalStatusAction } from "../actions"
import { GOALS_PATH } from "@/config/routes"

export type BoardGoal = {
  id: string
  name: string
  /** One line under the name, e.g. "3 logged · 1/4 checkpoints". */
  detail: string
  status: "active" | "someday"
}

type Status = BoardGoal["status"]

function Card({
  goal,
  overlay = false,
}: {
  goal: BoardGoal
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: goal.id,
    disabled: overlay,
  })
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 border bg-background p-2",
        isDragging && "opacity-40",
        overlay && "shadow-md"
      )}
    >
      <button
        type="button"
        aria-label={`Move ${goal.name}. Space to pick up, arrow keys to move, space to drop`}
        className="cursor-grab touch-none p-1 text-ink-3 hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical aria-hidden className="size-4" />
      </button>
      <Link
        href={`${GOALS_PATH}/${goal.id}`}
        prefetch
        className="flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="truncate font-medium">{goal.name}</span>
        <span className="text-xs text-ink-3">{goal.detail}</span>
      </Link>
    </li>
  )
}

function Zone({
  status,
  title,
  count,
  empty,
  goals,
}: {
  status: Status
  title: string
  count?: string
  empty: string
  goals: BoardGoal[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        "flex max-w-3xl flex-col gap-3 border border-transparent p-2 transition-colors",
        isOver && "border-dashed border-foreground bg-muted/40"
      )}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
          {title}
        </h2>
        {count ? (
          <span className="font-mono text-xs text-ink-3">{count}</span>
        ) : null}
      </div>
      {goals.length === 0 ? (
        <p className="py-4 text-ink-2">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((goal) => (
            <Card key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Active and Someday as two drop zones: drag a goal (or use the handle with the keyboard) to change
 * its status (GL-2, GL-3). The move shows at once and reverts with the reason when the database
 * refuses it.
 */
export function GoalBoard({
  goals,
  activeLimit,
}: {
  goals: BoardGoal[]
  activeLimit: number
}) {
  const [items, move] = useOptimistic(
    goals,
    (current, change: { id: string; status: Status }) =>
      current.map((goal) =>
        goal.id === change.id ? { ...goal, status: change.status } : goal
      )
  )
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState<BoardGoal>()

  const sensors = useSensors(
    // A small distance keeps a plain click from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const active = items.filter((goal) => goal.status === "active")
  const someday = items.filter((goal) => goal.status === "someday")

  function onDragStart(event: DragStartEvent) {
    setDragging(items.find((goal) => goal.id === event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(undefined)
    const target = event.over?.id as Status | undefined
    const goal = items.find((item) => item.id === event.active.id)
    if (!goal || !target || goal.status === target) return
    setError(undefined)
    if (target === "active" && active.length >= activeLimit) {
      setError(
        `You can have ${activeLimit} active goals. Move one to Someday first.`
      )
      return
    }
    startTransition(async () => {
      move({ id: goal.id, status: target })
      const result = await setGoalStatusAction({
        goalId: goal.id,
        status: target,
      })
      if (result.error) setError(result.error)
    })
  }

  return (
    <DndContext
      // A fixed id keeps dnd-kit's generated aria ids equal on server and client (no hydration warning).
      id="goal-board"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(undefined)}
    >
      <div className="flex flex-col gap-4">
        <Zone
          status="active"
          title="Active"
          count={`${active.length}/${activeLimit}`}
          empty="No active goals yet. A name is enough to start, or drag one here."
          goals={active}
        />
        <Zone
          status="someday"
          title="Someday"
          empty="Things you want to do later wait here. Drag a goal down to park it."
          goals={someday}
        />
        {error ? (
          <p role="alert" className="text-diff-del">
            {error}
          </p>
        ) : null}
      </div>
      <DragOverlay>
        {dragging ? <Card goal={dragging} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
