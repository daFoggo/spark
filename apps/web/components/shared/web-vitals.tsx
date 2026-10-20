"use client"

import { useReportWebVitals } from "next/web-vitals"

/**
 * Reports Core Web Vitals (FCP, LCP, CLS, INP, TTFB) for Google DevTools and logging.
 * In development, outputs formatted diagnostic logs directly to the Chrome DevTools console.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      const color =
        metric.rating === "good"
          ? "#22c55e"
          : metric.rating === "needs-improvement"
            ? "#eab308"
            : "#ef4444"
      const formattedValue =
        metric.name === "CLS"
          ? metric.value.toFixed(4)
          : `${Math.round(metric.value * 10) / 10}ms`

      // DevTools styled console entry
      console.debug(
        `%c[Web Vitals] ${metric.name}: ${formattedValue} (${metric.rating})`,
        `color: ${color}; font-weight: 500; font-family: monospace;`
      )
    }
  })

  return null
}
