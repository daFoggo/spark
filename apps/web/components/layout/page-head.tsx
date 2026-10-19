/** Page head of a dashboard page: mono label, title, one-line description. */
export function PageHead({
  label,
  title,
  children,
}: {
  label: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-3">
      <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        {label}
      </span>
      <h1 className="text-3xl leading-tight font-medium md:text-4xl">
        {title}
      </h1>
      {children ? <p className="max-w-2xl text-ink-2">{children}</p> : null}
    </header>
  )
}
