"use client"

import { useEffect } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

/**
 * Unexpected errors inside the dashboard keep the shell (sidebar, header) and replace only the page.
 * Expected failures never get here: Server Actions return them as values and rows show them inline.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Empty className="border border-dashed" role="alert">
      <EmptyHeader>
        <EmptyTitle>This page could not load</EmptyTitle>
        <EmptyDescription>
          Your data is safe. Try again in a moment.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => retry()}>Try again</Button>
      </EmptyContent>
    </Empty>
  )
}
