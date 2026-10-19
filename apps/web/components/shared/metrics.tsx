/** Metrics as one `dl` row: no stat cards (design system §8). */
export function Metrics({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">{children}</dl>
}

export function Metric({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        {label}
      </dt>
      <dd className="truncate text-2xl font-medium tabular-nums">{children}</dd>
    </div>
  )
}
