import { cn } from "@workspace/ui/lib/utils"

// Literal classes so Tailwind sees them; a line's `step` picks its reveal delay.
const DELAY = [
  "delay-0",
  "delay-150",
  "delay-300",
  "delay-500",
  "delay-700",
  "delay-1000",
] as const

type Step = 0 | 1 | 2 | 3 | 4 | 5

const reveal =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500 motion-safe:fill-mode-both"

/** Decorative terminal window (bg-card, h-7 bar, mono text-xs). */
export function Terminal({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <figure aria-hidden className="border bg-card font-mono text-xs">
      <div className="grid h-7 grid-cols-3 items-center border-b px-3 text-ink-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-ink-4" />
          <span className="size-2.5 rounded-full bg-ink-4" />
          <span className="size-2.5 rounded-full bg-ink-4" />
        </span>
        <span className="text-center">{title}</span>
      </div>
      <div className="flex flex-col gap-2 p-6 leading-relaxed text-ink-2">
        {children}
      </div>
    </figure>
  )
}

/** `$ spark <args>`, colored like the claude.dev CLI (program blue, args purple). */
export function TerminalCommand({
  step,
  children,
}: {
  step: Step
  children: React.ReactNode
}) {
  return (
    <p className={cn("flex gap-2", reveal, DELAY[step])}>
      <span className="text-ink-4">$</span>
      <span className="text-syn-blue">spark</span>
      <span className="text-syn-purple">{children}</span>
    </p>
  )
}

const TONE = {
  ok: "text-diff-add",
  muted: "text-ink-3",
  // Orange appears once per screen: give `focus` to a single line.
  focus: "text-brand-ink",
} as const

/** Output row: `└ label   value`. */
export function TerminalOutput({
  step,
  label,
  tone,
  children,
}: {
  step: Step
  label: string
  tone: keyof typeof TONE
  children: React.ReactNode
}) {
  return (
    <p className={cn("grid grid-cols-3 gap-2", reveal, DELAY[step])}>
      <span className="flex gap-2">
        <span className="text-ink-4">└</span>
        {label}
      </span>
      <span className={cn("col-span-2", TONE[tone])}>{children}</span>
    </p>
  )
}

/** Last line: prompt with a blinking caret. */
export function TerminalPrompt({ step }: { step: Step }) {
  return (
    <p
      className={cn(
        "mt-2 flex items-center gap-2 border-t pt-3",
        reveal,
        DELAY[step]
      )}
    >
      <span className="text-foreground">guest@spark</span>
      <span className="text-ink-4">&gt;</span>
      <span className="h-4 w-2 bg-foreground motion-safe:animate-pulse" />
    </p>
  )
}
