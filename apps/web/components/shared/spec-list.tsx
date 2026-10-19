/** `dt` / `└ dd` spec list (design system: article meta, inspector). */
export function SpecList({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>
}

export function SpecItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 border-b py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        {label}
      </dt>
      <dd className="flex min-w-0 gap-2 text-sm sm:col-span-2">
        <span aria-hidden className="text-ink-4">
          └
        </span>
        <span className="min-w-0 break-words">{children}</span>
      </dd>
    </div>
  )
}
