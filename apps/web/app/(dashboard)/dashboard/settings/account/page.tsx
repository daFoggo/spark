import type { Metadata } from "next"
import { Suspense } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { SpecItem, SpecList } from "@/components/shared/spec-list"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Account" }

async function Account() {
  const session = await requirePermission("settings:view")
  return (
    <SpecList>
      <SpecItem label="Name">{session.name ?? "Not set"}</SpecItem>
      <SpecItem label="Email">{session.email ?? "Not set"}</SpecItem>
      <SpecItem label="Role">
        <Badge variant="outline">{session.role}</Badge>
      </SpecItem>
      <SpecItem label="User ID">
        <code className="font-mono">{session.userId}</code>
      </SpecItem>
    </SpecList>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageHead label="Settings" title="Account">
        Your profile as the identity provider reports it.
      </PageHead>
      <Suspense fallback={<Skeleton className="h-48 max-w-2xl" />}>
        <Account />
      </Suspense>
    </>
  )
}
