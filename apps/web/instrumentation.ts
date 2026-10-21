import type { Instrumentation } from "next"

export function register() {
  // Can initialize APM or OpenTelemetry tracer here if needed.
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const errorMessage = err instanceof Error ? err.message : String(err)
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined

  // Filter out normal Next.js control-flow and prerender bail-out throws
  if (
    errorMessage.includes("NEXT_REDIRECT") ||
    errorMessage.includes("NEXT_NOT_FOUND") ||
    digest === "DYNAMIC_SERVER_USAGE" ||
    digest === "HANGING_PROMISE_REJECTION"
  ) {
    return
  }

  const payload = {
    message: errorMessage,
    digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType, // 'render' | 'route' | 'action' | 'proxy'
    routerKind: context.routerKind, // 'App Router' | 'Pages Router'
    timestamp: performance.now(),
  }

  console.error("[SERVER_ERROR]", JSON.stringify(payload))
}
