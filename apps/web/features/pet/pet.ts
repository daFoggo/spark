import { daysBetween, type LocalDate } from "@/lib/dates"

/** Pure pet rules (spec PT-2…PT-4). Size follows everything done; mood follows the recent rhythm. */

export const STAGES = [
  { from: 0, name: "Kitten" },
  { from: 30, name: "Young cat" },
  { from: 90, name: "Chubby cat" },
  { from: 200, name: "Round cat" },
  { from: 400, name: "Absolute unit" },
] as const

export type Mood = "happy" | "idle" | "sleepy"

export type PetState = {
  treats: number
  /** Index into STAGES; also the number of tangerines on the head. */
  stage: number
  stageName: string
  /** Treats left until the next stage, or null at the top. */
  untilNext: number | null
  nextName: string | null
  /** Body size 0..1 (PT-3). */
  fatness: number
  mood: Mood
}

/**
 * @param treats activities since adoption (PT-2)
 * @param lastActivity date of the newest activity, or null when there is none
 * @param weekRate this week's check-ins on due dates / due dates so far (0..1)
 */
export function petState(input: {
  treats: number
  lastActivity: LocalDate | null
  today: LocalDate
  weekRate: number
}): PetState {
  const { treats, lastActivity, today, weekRate } = input
  let stage = 0
  STAGES.forEach((s, index) => {
    if (treats >= s.from) stage = index
  })
  const next = STAGES[stage + 1]

  // PT-4: nothing today or yesterday -> sleepy; active today and on a good week -> happy.
  const idleDays =
    lastActivity === null ? Infinity : daysBetween(lastActivity, today)
  let mood: Mood = "idle"
  if (idleDays >= 2) mood = "sleepy"
  else if (idleDays === 0 && weekRate >= 0.6) mood = "happy"

  return {
    treats,
    stage,
    stageName: STAGES[stage]?.name ?? "Kitten",
    untilNext: next ? next.from - treats : null,
    nextName: next?.name ?? null,
    fatness: Math.min(1, treats / 400),
    mood,
  }
}
