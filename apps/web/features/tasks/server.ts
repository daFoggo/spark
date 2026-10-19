import "server-only"

import { addDays, type LocalDate } from "@/lib/dates"
import { createDataClient, DataError, unwrap } from "@/lib/supabase/data"

import { DONE_VISIBLE_DAYS } from "./rules"
import { TaskSchema, type Task, type TaskList, type TaskTab } from "./schemas"

const COLUMNS =
  "id, title, note, goal_id, list, created_on, done_on, focus_from"

type Row = {
  id: string
  title: string
  note: string | null
  goal_id: string | null
  list: string
  created_on: string
  done_on: string | null
  focus_from: string | null
}

/** RV-4: a focus task counts as a today task from `focus_from` on, whichever list it was saved in. */
const toTask = (row: Row, today: LocalDate): Task =>
  TaskSchema.parse({
    id: row.id,
    title: row.title,
    note: row.note,
    goalId: row.goal_id,
    list: row.focus_from && row.focus_from <= today ? "today" : row.list,
    createdOn: row.created_on,
    doneOn: row.done_on,
  })

/** Tasks of one tab: open ones oldest first (the ones carrying over lead), then those finished today; the Done tab lists finished ones newest first (TK-8). */
export async function fetchTasks(
  accessToken: string,
  input: { tab: TaskTab; today: LocalDate }
): Promise<Task[]> {
  const select = createDataClient(accessToken).from("tasks").select(COLUMNS)
  let query
  if (input.tab === "done") {
    query = select
      .not("done_on", "is", null)
      .gte("done_on", addDays(input.today, -DONE_VISIBLE_DAYS))
      .order("done_on", { ascending: false })
  } else {
    // Tasks finished today stay on their list until tomorrow, so "Add to log?" has a row to sit under.
    const open = select.or(`done_on.is.null,done_on.eq.${input.today}`)
    query = (
      input.tab === "today"
        ? open.or(`list.eq.today,focus_from.lte.${input.today}`)
        : open
            .eq("list", "later")
            .or(`focus_from.is.null,focus_from.gt.${input.today}`)
    )
      .order("created_on")
      .order("created_at")
  }
  const tasks = unwrap(await query.order("id")).map((row) =>
    toTask(row, input.today)
  )
  // Open tasks first, tasks finished today after them (stable sort keeps the carry-over order).
  return input.tab === "done"
    ? tasks
    : tasks.sort(
        (a, b) => Number(a.doneOn !== null) - Number(b.doneOn !== null)
      )
}

export async function insertTask(
  accessToken: string,
  input: { title: string; list: TaskList; goalId: string | null }
): Promise<void> {
  unwrap(
    await createDataClient(accessToken)
      .from("tasks")
      .insert({
        title: input.title,
        list: input.list,
        goal_id: input.goalId,
      })
      .select("id")
      .single()
  )
}

/** TK-6, TK-7: the database stamps today's local date; returns it, or null when un-completed. */
export async function setTaskDone(
  accessToken: string,
  taskId: string,
  done: boolean
): Promise<LocalDate | null> {
  const { data, error } = await createDataClient(accessToken).rpc(
    "set_task_done",
    { p_task_id: taskId, p_done: done }
  )
  if (error) throw new DataError(error.code, error.message)
  return (data as LocalDate | null) ?? null
}

/** TK-6: adds a completed, goal-linked task to the log. Returns the activity id. */
export async function logTask(
  accessToken: string,
  taskId: string
): Promise<number> {
  return unwrap(
    await createDataClient(accessToken).rpc("log_task", { p_task_id: taskId })
  )
}

export async function updateTask(
  accessToken: string,
  taskId: string,
  patch: {
    note?: string | null
    list?: TaskList
    createdOn?: LocalDate
    focusFrom?: LocalDate | null
  }
): Promise<void> {
  unwrap(
    await createDataClient(accessToken)
      .from("tasks")
      .update({
        note: patch.note,
        list: patch.list,
        created_on: patch.createdOn,
        focus_from: patch.focusFrom,
      })
      .eq("id", taskId)
      .select("id")
      .single()
  )
}

export async function deleteTask(
  accessToken: string,
  taskId: string
): Promise<void> {
  unwrap(
    await createDataClient(accessToken)
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .select("id")
      .single()
  )
}
