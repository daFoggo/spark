import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { DASHBOARD_PATH } from "@/config/routes"

/** A habit, goal or task that does not exist, or belongs to someone else (RLS returns nothing). */
export default function DashboardNotFound() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyTitle>Nothing here</EmptyTitle>
        <EmptyDescription>
          It may have been archived, or the link is not right.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href={DASHBOARD_PATH} />} nativeButton={false}>
          Back to Today
        </Button>
      </EmptyContent>
    </Empty>
  )
}
