import { InfoHint } from "@/components/shared/info-hint"
import type { HelpKey } from "@/config/help"

/** Page head of a dashboard page: mono label, title, one-line description. */
export function PageHead({
  label,
  title,
  hint,
  children,
}: {
  label: string
  title: string
  /** Adds an info button that explains what this page is for. */
  hint?: HelpKey
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-3">
      <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <h1 className="text-3xl leading-tight font-medium md:text-4xl">
          {title}
        </h1>
        {hint ? <InfoHint topic={hint} /> : null}
      </div>
      {children ? <p className="max-w-2xl text-ink-2">{children}</p> : null}
    </header>
  )
}
