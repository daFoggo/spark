import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { SettingsForm } from "@/features/settings/components/settings-form"
import { getSettings } from "@/features/settings/queries"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Preferences" }

async function Preferences() {
  await requirePermission("settings:view")
  return <SettingsForm settings={await getSettings()} />
}

export default function PreferencesPage() {
  return (
    <>
      <PageHead label="Settings" title="Preferences">
        Your timezone, when your week starts, and what your pet is called.
      </PageHead>
      <Suspense fallback={<Skeleton className="h-80 max-w-2xl" />}>
        <Preferences />
      </Suspense>
    </>
  )
}
