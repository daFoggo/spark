import { describe, expect, it } from "vitest"

import { timezoneOption, timezoneRegions } from "../timezones"

const NOW = new Date("2026-01-15T12:00:00Z")

describe("timezoneRegions", () => {
  it("groups every runtime zone under a known region", () => {
    const regions = timezoneRegions(NOW)
    const zones = regions.flatMap((region) => region.zones.map((z) => z.value))

    expect(zones).toHaveLength(Intl.supportedValuesOf("timeZone").length)
    expect(regions.map((region) => region.label)).toContain("Asia")
  })

  it("labels a zone with its current offset", () => {
    expect(timezoneOption("Asia/Bangkok", NOW).label).toBe(
      "Asia/Bangkok (GMT+07:00)"
    )
    // Engines differ for zero offsets: "GMT" (browsers) or "GMT+00:00" (Node).
    expect(timezoneOption("UTC", NOW).label).toMatch(/^UTC \(GMT/)
  })
})
