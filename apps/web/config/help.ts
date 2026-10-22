/**
 * Plain-language help copy, written once. The info buttons (`InfoHint`) and the Guide page both
 * read it, so a rule is never explained two ways. Wording follows spec §1 (familiar words) and
 * the rule ids in `docs/goals-habits/spec.md`.
 */
export type HelpTopic = {
  title: string
  body: string
  /** Guide section the topic belongs to. */
  group: "basics" | "rhythm" | "pet" | "review"
}

export const HELP = {
  goal: {
    group: "basics",
    title: "Goal",
    body: "Something you are working towards. A name is enough to start. Keep three or fewer active; the rest wait in Someday.",
  },
  habit: {
    group: "basics",
    title: "Habit",
    body: "A small promise on a schedule you choose. Checking it in is one tap. Link it to a goal if it belongs to one.",
  },
  task: {
    group: "basics",
    title: "Task",
    body: "A one-off thing to do. Type #goal-name to link it to a goal. Open tasks carry over to the next day.",
  },
  log: {
    group: "basics",
    title: "Log",
    body: "Everything you did, in one list: habit ticks and tasks you counted for a goal. There is nothing extra to fill in; more effort is another tick or a finished task.",
  },
  backdate: {
    group: "rhythm",
    title: "Missed a day?",
    body: "Pick the day in the This week strip in the side panel ([I]). You can fill in today and the 3 days before it; older days are read-only.",
  },
  minimum: {
    group: "rhythm",
    title: "Minimum version",
    body: "The tiny version of a habit for a low-energy day, such as putting the shoes on. Checking in the minimum still counts and keeps your streak.",
  },
  streak: {
    group: "rhythm",
    title: "Streak",
    body: "Days in a row you kept the habit on its due dates. One miss never breaks it; two in a row does. Days it is not scheduled and paused days are skipped.",
  },
  consistency: {
    group: "rhythm",
    title: "Last 30 days",
    body: "Check-ins on due dates divided by due dates over the last 30 days. Extra sessions do not count, so it never goes above 100%.",
  },
  weeklyTarget: {
    group: "rhythm",
    title: "Weekly target",
    body: "80% of this week's due check-ins. It shows how many are left to reach it.",
  },
  extra: {
    group: "rhythm",
    title: "Extra sessions",
    body: "You can check in a habit on a day it is not scheduled. It counts as a treat and towards the goal, but not for the streak or consistency.",
  },
  heatmap: {
    group: "rhythm",
    title: "Activity map",
    body: "Each square is a day; darker means more done. On a habit, a full check-in is darkest and the minimum version is lighter. Empty squares are days off.",
  },
  carryOver: {
    group: "rhythm",
    title: "Carry-over",
    body: 'A task you did not finish stays on your list. After 5 days Spark asks "Still want to do this?" so the list does not fill with things you dropped.',
  },
  checkpoints: {
    group: "basics",
    title: "Checkpoints",
    body: "Milestones for a goal with a finish line. Progress is the share you have ticked.",
  },
  treats: {
    group: "pet",
    title: "Treats",
    body: "Every check-in, log or finished task is a treat for your cat. Treats grow it through five stages.",
  },
  pet: {
    group: "pet",
    title: "Your cat",
    body: "It sleeps when you skipped yesterday and today, and is happy when you are on track this week. It never gets sick or hungry.",
  },
  upNext: {
    group: "review",
    title: "Up next",
    body: "The tasks you picked as this week's focus in the weekly review, plus anything due soon.",
  },
  review: {
    group: "review",
    title: "Weekly review",
    body: "Five minutes once a week: look back, adjust or pause habits that did not fit, and choose up to 3 tasks to focus on. Nothing is saved until you press Finish.",
  },
} as const satisfies Record<string, HelpTopic>

export type HelpKey = keyof typeof HELP

export const HELP_GROUPS: { key: HelpTopic["group"]; title: string }[] = [
  { key: "basics", title: "The building blocks" },
  { key: "rhythm", title: "Keeping a rhythm" },
  { key: "pet", title: "Your companion" },
  { key: "review", title: "Looking back" },
]
