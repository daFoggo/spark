/**
 * Local-date helpers (spec TM-1..TM-4). A "local date" is a `YYYY-MM-DD` string in the user's timezone;
 * all arithmetic runs on UTC midnights, so it never depends on the server's own timezone or on DST.
 * Pure: reading the clock is `lib/clock.ts`.
 */

export type LocalDate = string // "YYYY-MM-DD"

const DAY_MS = 86_400_000

const toUtc = (date: LocalDate) => Date.parse(`${date}T00:00:00Z`)
const fromUtc = (ms: number): LocalDate =>
  new Date(ms).toISOString().slice(0, 10)

/** The calendar date `instant` falls on in `timezone` (IANA name). */
export function localDate(instant: Date, timezone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** 0 = Sunday .. 6 = Saturday. */
export function weekday(date: LocalDate): number {
  return new Date(toUtc(date)).getUTCDay()
}

/** First day of the week containing `date`; `weekStart` is 0 (Sunday) .. 6 (Saturday). */
export function startOfWeek(date: LocalDate, weekStart: number): LocalDate {
  const back = (weekday(date) - weekStart + 7) % 7
  return addDays(date, -back)
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const days = daysBetween(from, to)
  return days < 0
    ? []
    : Array.from({ length: days + 1 }, (_, i) => addDays(from, i))
}

export const isLocalDate = (value: string): value is LocalDate =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUtc(toUtc(value)) === value

const SHORT_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
})

/** "Mon, Oct 19": for tooltips and notes. */
export const formatDay = (date: LocalDate): string =>
  SHORT_DAY.format(new Date(toUtc(date)))
