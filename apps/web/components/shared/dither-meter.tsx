/** Dithered usage meter (design system §8): solid ink fill over a 2px checker. `value` is 0..100. */
export function DitherMeter({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div className="flex items-center gap-3 font-mono text-xs text-ink-2 tabular-nums">
      <div
        role="img"
        aria-label={`${label}: ${clamped}%`}
        className="relative h-3 flex-1 bg-dither"
      >
        <i
          className="absolute inset-y-0 left-0 bg-foreground"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span>{clamped}%</span>
    </div>
  )
}
