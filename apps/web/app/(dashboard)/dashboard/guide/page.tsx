import {
  IconArrowDown,
  IconArrowRight,
  IconCalendarCheck,
  IconChecklist,
  IconRepeat,
  IconSunHigh,
  IconTarget,
  type Icon,
} from "@tabler/icons-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { buttonVariants } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHead } from "@/components/layout/page-head"
import { HELP, HELP_GROUPS } from "@/config/help"
import {
  DASHBOARD_PATH,
  GOALS_PATH,
  HABITS_PATH,
  REVIEW_PATH,
  TASKS_PATH,
} from "@/config/routes"
import { Mochi } from "@/features/pet/components/mochi"
import { STAGES } from "@/features/pet/pet"
import { requirePermission } from "@/lib/dal"

export const metadata: Metadata = { title: "Guide" }

function SectionTitle({
  children,
  note,
}: {
  children: React.ReactNode
  note?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-mono text-sm font-medium tracking-wide uppercase">
        {children}
      </h2>
      {note ? <p className="max-w-2xl text-ink-2">{note}</p> : null}
    </div>
  )
}

function OpenLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {children}
    </Link>
  )
}

function Lane({
  icon: Glyph,
  step,
  title,
  text,
  links,
}: {
  icon: Icon
  step: string
  title: string
  text: string
  links: { href: string; label: string }[]
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 border p-4">
      <span className="flex items-center gap-2 font-mono text-xs tracking-wider text-ink-3 uppercase">
        <Glyph aria-hidden className="size-4 text-primary" />
        {step}
      </span>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-ink-2">{text}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {links.map((link) => (
          <OpenLink key={link.href} href={link.href}>
            {link.label}
          </OpenLink>
        ))}
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <span aria-hidden className="flex items-center justify-center text-ink-3">
      <IconArrowDown className="size-5 md:hidden" />
      <IconArrowRight className="hidden size-5 md:block" />
    </span>
  )
}

type Day = "full" | "min" | "miss"

const DAY_CLASS: Record<Day, string> = {
  full: "bg-heat-4 text-background",
  min: "bg-heat-2 text-foreground",
  miss: "border border-dashed text-ink-3",
}
const DAY_NAME: Record<Day, string> = {
  full: "done",
  min: "minimum",
  miss: "missed",
}
const WEEK = ["M", "T", "W", "T", "F"]

const RHYTHM: { title: string; text: string; days: Day[]; streak: number }[] = [
  {
    title: "Keep it up",
    text: "Each full check-in adds a day to the streak.",
    days: ["full", "full", "full", "full", "full"],
    streak: 5,
  },
  {
    title: "One miss is forgiven",
    text: "Skip a day and the streak carries on.",
    days: ["full", "full", "miss", "full", "full"],
    streak: 4,
  },
  {
    title: "Two in a row resets it",
    text: "Never miss twice: the second miss starts over.",
    days: ["full", "full", "miss", "miss", "full"],
    streak: 1,
  },
  {
    title: "A small day still counts",
    text: "The minimum version is lighter, but it keeps the streak.",
    days: ["full", "min", "min", "full", "full"],
    streak: 5,
  },
]

async function Guide() {
  await requirePermission("dashboard:view")
  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <section className="flex flex-col gap-5">
        <SectionTitle note="Aim is optional. Most days you only need Today.">
          How it fits together
        </SectionTitle>
        <div className="flex flex-col gap-3 md:flex-row">
          <Lane
            icon={IconTarget}
            step="1 · Aim"
            title="Goals"
            text="Something you are working towards. A name is enough; link habits and tasks to it later."
            links={[{ href: GOALS_PATH, label: "Open goals" }]}
          />
          <Arrow />
          <Lane
            icon={IconRepeat}
            step="2 · Do"
            title="Habits and tasks"
            text="Tick a habit on the day you did it, or finish a task. Did more than planned? Tick the habit again on a day it is not scheduled. One tap each, on Today."
            links={[
              { href: DASHBOARD_PATH, label: "Go to Today" },
              { href: HABITS_PATH, label: "Habits" },
              { href: TASKS_PATH, label: "Tasks" },
            ]}
          />
          <Arrow />
          <Lane
            icon={IconCalendarCheck}
            step="3 · Look back"
            title="Weekly review"
            text="Five minutes to see what worked, ease or pause what did not, and pick next week's focus."
            links={[{ href: REVIEW_PATH, label: "Start a review" }]}
          />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <SectionTitle note="Streaks are forgiving on purpose. Each row is a week of check-ins.">
          Streaks, drawn
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {RHYTHM.map((row) => (
            <div key={row.title} className="flex flex-col gap-3 border p-4">
              <ol className="flex items-center gap-1.5">
                {row.days.map((day, index) => (
                  <li
                    key={index}
                    className={`flex size-9 items-center justify-center font-mono text-xs ${DAY_CLASS[day]}`}
                  >
                    {WEEK[index]}
                    <span className="sr-only"> {DAY_NAME[day]}</span>
                  </li>
                ))}
                <li className="ml-auto font-mono text-xs text-ink-3 uppercase">
                  Streak {row.streak}
                </li>
              </ol>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{row.title}</h3>
                <p className="text-ink-2">{row.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <SectionTitle note="Everything you do is a treat. Treats grow your cat through five stages.">
          Your cat
        </SectionTitle>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((stage, index) => (
            <li
              key={stage.name}
              className="flex flex-col items-center gap-3 border p-4"
            >
              <div className="flex flex-1 items-end">
                <Mochi
                  name={stage.name}
                  fatness={Math.min(1, stage.from / 400)}
                  mood="happy"
                  stage={index}
                  scale={3}
                />
              </div>
              <span className="font-medium">{stage.name}</span>
              <span className="font-mono text-xs text-ink-3">
                {stage.from} treats
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-5">
        <SectionTitle note="Open one for the short version. The same words appear in the info buttons across the app.">
          Words used in Spark
        </SectionTitle>
        {HELP_GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
              {group.title}
            </span>
            <Accordion className="max-w-3xl">
              {Object.entries(HELP)
                .filter(([, topic]) => topic.group === group.key)
                .map(([key, topic]) => (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger>{topic.title}</AccordionTrigger>
                    <AccordionContent className="text-ink-2">
                      {topic.body}
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Shortcuts</SectionTitle>
        <p className="flex items-center gap-2 text-ink-2">
          <Kbd>I</Kbd> opens the side panel with your cat, week and next tasks.
        </p>
        <p className="flex items-center gap-2 text-ink-2">
          <IconCalendarCheck aria-hidden className="size-4" />
          Missed a day? Pick it in the This week strip in the side panel.
        </p>
        <p className="flex items-center gap-2 text-ink-2">
          <IconSunHigh aria-hidden className="size-4" />
          Today is the page to live in; everything else is for looking deeper.
        </p>
        <p className="flex items-center gap-2 text-ink-2">
          <IconChecklist aria-hidden className="size-4" />
          In a task, type <Kbd>#</Kbd> to link it to a goal.
        </p>
      </section>
    </div>
  )
}

export default function GuidePage() {
  return (
    <>
      <PageHead label="Help" title="How Spark works">
        Habits, tasks and goals in plain words. No planning needed up front.
      </PageHead>
      <Suspense fallback={<Skeleton className="h-96 max-w-5xl" />}>
        <Guide />
      </Suspense>
    </>
  )
}
