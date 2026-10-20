import { addDays, isLocalDate, type LocalDate } from "@/lib/dates"

/** AC-5: check-ins and logs can go back this many days. */
export const BACKDATE_DAYS = 3

/** The day Today shows (AC-10): `?day=` when it is within the back-dating window, else today. */
export async function resolveDay(
  searchParams: Promise<{ day?: string }>,
  today: LocalDate
): Promise<LocalDate> {
  const { day } = await searchParams
  return day &&
    isLocalDate(day) &&
    day <= today &&
    day >= addDays(today, -BACKDATE_DAYS)
    ? day
    : today
}
