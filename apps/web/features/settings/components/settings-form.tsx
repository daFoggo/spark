"use client"

import { IconCircleCheck } from "@tabler/icons-react"
import { useActionState, useState } from "react"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"

import { updateSettingsAction } from "../actions"
import type { Settings } from "../schemas"
import { timezoneOption, timezoneRegions } from "../timezones"

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
].map((label, index) => ({ value: String(index), label }))

/**
 * Built only while the list is open, so in the browser: zones and offsets come from its `Intl` and "now", which
 * the server render would not match.
 */
function TimezoneItems({ current }: { current: string }) {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
  const regions = timezoneRegions()
  const listed = new Set(regions.flatMap((r) => r.zones.map((z) => z.value)))
  const pinned = [...new Set([browser, current])].map((zone) =>
    timezoneOption(zone)
  )

  return (
    <>
      <SelectGroup>
        <SelectLabel>
          Your browser{listed.has(current) ? "" : ", current"}
        </SelectLabel>
        {pinned.map((zone) => (
          <SelectItem key={zone.value} value={zone.value}>
            {zone.label}
          </SelectItem>
        ))}
      </SelectGroup>
      {regions.map((region) => (
        <SelectGroup key={region.label}>
          <SelectLabel>{region.label}</SelectLabel>
          {region.zones
            .filter((zone) => !pinned.some((p) => p.value === zone.value))
            .map((zone) => (
              <SelectItem key={zone.value} value={zone.value}>
                {zone.label}
              </SelectItem>
            ))}
        </SelectGroup>
      ))}
    </>
  )
}

/** Timezone (TM-2), week start (TM-4) and pet name (PT-1). */
export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, {})
  const values = state.values ?? {
    timezone: settings.timezone,
    weekStart: String(settings.weekStart),
    petName: settings.petName,
  }
  const [timezone, setTimezone] = useState(values.timezone)
  const [weekStart, setWeekStart] = useState(values.weekStart)

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FieldGroup>
        <Field data-invalid={state.rule === "TM-2" ? true : undefined}>
          <FieldLabel htmlFor="settings-timezone">Timezone</FieldLabel>
          <Select
            name="timezone"
            value={timezone}
            onValueChange={(value) => value && setTimezone(value)}
          >
            <SelectTrigger id="settings-timezone" className="w-full">
              {/* The items exist only while the list is open, so show the stored name itself. */}
              <SelectValue>{(value: string) => value}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <TimezoneItems current={timezone} />
            </SelectContent>
          </Select>
          <FieldDescription>
            Changing it does not move dates you already logged.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-week-start">Week starts on</FieldLabel>
          <Select
            name="weekStart"
            items={WEEKDAYS}
            value={weekStart}
            onValueChange={(value) => value && setWeekStart(value)}
          >
            <SelectTrigger id="settings-week-start" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Weekly targets, reviews and “This week” follow it.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-pet-name">Pet name</FieldLabel>
          <Input
            id="settings-pet-name"
            name="petName"
            defaultValue={values.petName}
            maxLength={20}
            required
          />
        </Field>
      </FieldGroup>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      {state.saved ? (
        <Alert variant="success">
          <IconCircleCheck />
          <AlertDescription>Settings saved.</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Save
      </Button>
    </form>
  )
}
