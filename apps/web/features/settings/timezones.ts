export type TimezoneOption = { value: string; label: string }
export type TimezoneRegion = { label: string; zones: TimezoneOption[] }

const REGIONS: [prefix: string, label: string][] = [
  ["Africa", "Africa"],
  ["America", "Americas"],
  ["Antarctica", "Antarctica"],
  ["Arctic", "Arctic"],
  ["Asia", "Asia"],
  ["Atlantic", "Atlantic"],
  ["Australia", "Australia"],
  ["Europe", "Europe"],
  ["Indian", "Indian Ocean"],
  ["Pacific", "Pacific"],
  ["Etc", "UTC and fixed offsets"],
]

/** Current UTC offset of a zone, e.g. "GMT+07:00". */
function offsetLabel(zone: string, now: Date): string {
  try {
    return (
      new Intl.DateTimeFormat("en", {
        timeZone: zone,
        timeZoneName: "longOffset",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ?? "GMT"
    )
  } catch {
    return "GMT"
  }
}

export function timezoneOption(zone: string, now = new Date()): TimezoneOption {
  return { value: zone, label: `${zone} (${offsetLabel(zone, now)})` }
}

/**
 * The runtime's IANA zones grouped by region, with their current offset (TM-2). Uses the browser's list so the
 * picker offers the same names `Intl` reports for the user's own zone (e.g. `Asia/Saigon` in Chromium); the
 * database validates every name against `pg_timezone_names`. Call it in the browser only: offsets depend on "now".
 */
export function timezoneRegions(now = new Date()): TimezoneRegion[] {
  const grouped = new Map<string, TimezoneOption[]>()
  for (const zone of Intl.supportedValuesOf("timeZone")) {
    const prefix = zone.includes("/") ? zone.split("/")[0]! : "Etc"
    const zones = grouped.get(prefix) ?? []
    zones.push(timezoneOption(zone, now))
    grouped.set(prefix, zones)
  }
  return REGIONS.filter(([prefix]) => grouped.has(prefix)).map(
    ([prefix, label]) => ({ label, zones: grouped.get(prefix)! })
  )
}
