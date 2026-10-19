import { cn } from "@workspace/ui/lib/utils"

// 8x8 pixel grid: every mark size is a whole multiple (2, 3, 4px per pixel), so it stays crisp.
const MARK = { sm: "size-4", md: "size-6", lg: "size-8" } as const
// `/none`: line-height 1, so the wordmark box is exactly its font size and centers on the mark.
const TEXT = {
  sm: "text-sm/none",
  md: "text-lg/none",
  lg: "text-2xl/none",
} as const
const GAP = { sm: "gap-2", md: "gap-2.5", lg: "gap-3" } as const

type Size = keyof typeof MARK
type Motion = "static" | "idle"

/**
 * A `>` prompt (ink, follows the theme), a little spark (brand) and one ember (ink-4).
 * `idle`: the spark twinkles (+ flips to ×) and embers rise, frame by frame (`steps()`).
 * Under prefers-reduced-motion the idle mark renders exactly like the static one.
 */
function LogoMark({ size, motion }: { size: Size; motion: Motion }) {
  const idle = motion === "idle"
  return (
    <svg
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("shrink-0", MARK[size])}
    >
      <g className="fill-current">
        <rect x="0" y="1" width="1" height="1" />
        <rect x="1" y="2" width="1" height="1" />
        <rect x="2" y="3" width="1" height="2" />
        <rect x="1" y="5" width="1" height="1" />
        <rect x="0" y="6" width="1" height="1" />
      </g>
      <g className={cn("fill-brand", idle && "motion-safe:animate-spark-plus")}>
        <rect x="5" y="2" width="1" height="1" />
        <rect x="4" y="3" width="3" height="1" />
        <rect x="5" y="4" width="1" height="1" />
      </g>
      {idle ? (
        <>
          <g className="fill-brand opacity-0 motion-safe:animate-spark-cross">
            <rect x="4" y="2" width="1" height="1" />
            <rect x="6" y="2" width="1" height="1" />
            <rect x="5" y="3" width="1" height="1" />
            <rect x="4" y="4" width="1" height="1" />
            <rect x="6" y="4" width="1" height="1" />
          </g>
          <g className="fill-ink-4">
            <rect
              x="7"
              y="3"
              width="1"
              height="1"
              className="opacity-0 motion-safe:animate-spark-rise"
            />
            <rect
              x="6"
              y="2"
              width="1"
              height="1"
              className="opacity-0 motion-safe:animate-spark-rise-late"
            />
            <rect
              x="4"
              y="2"
              width="1"
              height="1"
              className="opacity-0 motion-safe:animate-spark-rise-later"
            />
          </g>
        </>
      ) : null}
      {/* The static ember; in `idle` the rising embers take its place (only when motion is allowed). */}
      <rect
        x="7"
        y="1"
        width="1"
        height="1"
        className={cn("fill-ink-4", idle && "motion-safe:hidden")}
      />
    </svg>
  )
}

/**
 * Spark logo (design system § Logo). `full` (mark + wordmark) by default; `mark` where space is
 * tight; `wordmark` where the mark already shows nearby. `size` scales mark and wordmark together.
 * `motion` is `idle` everywhere in the app; `static` only where the mark must stay still (print, dense lists).
 * Pure visual: wrap it in a Link where it should navigate.
 */
export function AppLogo({
  variant = "full",
  size = "md",
  motion = "idle",
  className,
}: {
  variant?: "full" | "mark" | "wordmark"
  size?: Size
  motion?: Motion
  className?: string
}) {
  return (
    <span
      role={variant === "mark" ? "img" : undefined}
      aria-label={variant === "mark" ? "Spark" : undefined}
      // Block-level flex: an inline-flex box sits on the text baseline and leaves a gap below it.
      className={cn("flex w-fit items-center", GAP[size], className)}
    >
      {variant === "wordmark" ? null : <LogoMark size={size} motion={motion} />}
      {variant === "mark" ? null : (
        <span
          className={cn("font-mono font-medium tracking-tight", TEXT[size])}
        >
          spark
        </span>
      )}
    </span>
  )
}
