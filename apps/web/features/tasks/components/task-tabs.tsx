"use client"

import { useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { TASKS_PATH } from "@/config/routes"

const TABS = [
  { value: "today", label: "Today" },
  { value: "later", label: "Later" },
  { value: "done", label: "Done" },
] as const

/** The tab lives in the URL (`?tab=`), so it survives reloads and can be shared (data-fetching §7.2). */
export function TaskTabs({ value }: { value: string }) {
  const router = useRouter()
  return (
    <Tabs
      value={value}
      onValueChange={(next) => router.push(`${TASKS_PATH}?tab=${next}`)}
    >
      <TabsList variant="line">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
