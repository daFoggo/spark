import { cn } from "@workspace/ui/lib/utils"

/**
 * Stagger on enter (design system §9): each direct child slides up 8px and fades in,
 * `duration-500 ease-out`, one `delay-75` step after the previous. Children that stream in
 * later (Suspense) animate when they appear. Off under prefers-reduced-motion.
 */
export function Stagger({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "*:motion-safe:animate-in *:motion-safe:duration-500 *:motion-safe:ease-out *:motion-safe:fill-mode-both *:motion-safe:fade-in *:motion-safe:slide-in-from-bottom-2",
        "*:nth-2:delay-75 *:nth-3:delay-150 *:nth-4:delay-200 *:nth-5:delay-300",
        className
      )}
    >
      {children}
    </div>
  )
}
