import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { DASHBOARD_PATH, SIGN_IN_PATH } from "@/config/routes"
import { getAuthProvider } from "@/lib/auth"
import { publicEnv } from "@/lib/env.public"

/** OAuth redirect target (PKCE): exchanges `?code=` for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  // `request.nextUrl.origin` can be the internal host behind a reverse proxy; use the public URL.
  const origin = publicEnv.NEXT_PUBLIC_APP_URL
  const code = searchParams.get("code")

  if (code) {
    try {
      const provider = await getAuthProvider()
      if (provider.oauth) {
        await provider.oauth.exchangeCode(code)
        return NextResponse.redirect(new URL(DASHBOARD_PATH, origin))
      }
    } catch {
      // fall through to the error redirect
    }
  }
  return NextResponse.redirect(new URL(`${SIGN_IN_PATH}?error=oauth`, origin))
}
