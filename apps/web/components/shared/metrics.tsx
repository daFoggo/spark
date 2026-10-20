import { InfoHint } from "@/components/shared/info-hint"
import type { HelpKey } from "@/config/help"

/** Metrics as one `dl` row: no stat cards (design system §8). */
export function Metrics({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">{children}</dl>
}

export function Metric({
  label,
  hint,
  children,
}: {
  label: string
  /** Explains the metric in an info button. */
  hint?: HelpKey
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="flex items-center gap-1 font-mono text-xs tracking-wider text-ink-3 uppercase">
        {label}
        {hint ? <InfoHint topic={hint} /> : null}
      </dt>
      <dd className="truncate text-2xl font-medium tabular-nums">{children}</dd>
    </div>
  )
}
