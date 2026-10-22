"use client"

import { useEffect } from "react"

// `global-error` renders its own document without the app's global CSS (Next docs, error.md),
// so Tailwind classes and theme tokens do not apply: minimal inline styles with system colors,
// which follow the OS color scheme.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <body
        style={{
          minHeight: "100svh",
          margin: 0,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "Canvas",
          color: "CanvasText",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Application error</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.7 }}>
          A critical error occurred. Please refresh or try again.
        </p>
        <button
          onClick={() => retry()}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
