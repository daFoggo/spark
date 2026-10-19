"use client"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Stagger on enter (design system §9): each direct child slides up 8px and fades in,
 * `duration-500 ease-out`, one `delay-75` step after the previous. Children that stream in
 * later (Suspense) animate when they appear. Off under prefers-reduced-motion.
 *
 * Plays once per element. Cache Components keeps visited routes mounted and hides them with
 * `display: none` (React `<Activity>`); a CSS animation restarts when its element is shown again,
 * so once a child has finished entering it is switched off and going back to a page is instant.
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
      onAnimationEnd={(event) => {
        const child = event.target
        if (
          child instanceof HTMLElement &&
          child.parentElement === event.currentTarget
        ) {
          child.style.animation = "none"
        }
      }}
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
