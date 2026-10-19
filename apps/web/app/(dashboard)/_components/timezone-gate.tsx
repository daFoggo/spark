import { TimezoneSync } from "@/features/settings/components/timezone-sync"
import { getSettings } from "@/features/settings/queries"

/** Mounts the one-time timezone sync until the browser's timezone has been saved. */
export async function TimezoneGate() {
  const settings = await getSettings()
  return settings.timezoneConfirmed ? null : <TimezoneSync />
}
