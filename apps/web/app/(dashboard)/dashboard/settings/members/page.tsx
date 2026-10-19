import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { EmptyState } from "@/components/shared/empty-state"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Members" }

async function Members() {
  // Admin only: other roles get app/forbidden.tsx (403).
  await requirePermission("members:view")
  return (
    <EmptyState
      title="No members feature yet"
      description="Add features/members with its queries and actions, then list members here."
    />
  )
}

export default function MembersPage() {
  return (
    <>
      <PageHead label="Settings" title="Members">
        People in this workspace and their roles.
      </PageHead>
      <Suspense fallback={<Skeleton className="h-32" />}>
        <Members />
      </Suspense>
    </>
  )
}
