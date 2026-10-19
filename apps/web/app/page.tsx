import { redirect } from "next/navigation"

import { DASHBOARD_PATH } from "@/config/routes"

/**
 * `proxy.ts` already sends `/` to the dashboard (signed in) or sign-in (signed out) in one hop.
 * This is the fallback when the proxy is skipped: the dashboard bounces visitors without a session.
 */
export default function Page() {
  redirect(DASHBOARD_PATH)
}
