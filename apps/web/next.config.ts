import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

/**
 * Content-Security-Policy without nonces: nonces force dynamic rendering of every page
 * and are incompatible with Partial Prerendering (docs: guides/content-security-policy).
 */
function contentSecurityPolicy(): string {
  const formActions = ["'self'", "https://accounts.google.com"]
  // Supabase OAuth sends the browser to the project's auth server before Google.
  if (
    process.env.AUTH_PROVIDER === "supabase" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    formActions.push(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin)
  }

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action ${formActions.join(" ")}`,
    "frame-ancestors 'none'",
  ]
  // Upgrading to https would break http://localhost during development.
  if (!isDev) directives.push("upgrade-insecure-requests")
  return directives.join("; ")
}

// Turbopack compiles workspace packages (e.g. @workspace/ui) automatically,
// so `transpilePackages` is not needed here.
const nextConfig: NextConfig = {
  // Recommended for all new apps from Next.js 16.4 (default in create-next-app).
  cacheComponents: true,
  partialPrefetching: true,
  // Enables forbidden() / forbidden.tsx, used by requirePermission() in lib/dal.ts.
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ["@tabler/icons-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
