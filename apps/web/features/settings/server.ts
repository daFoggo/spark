import "server-only"

import { authConfig } from "@/lib/auth/config"

import * as api from "./server.api"
import * as supabase from "./server.supabase"

/** The data path of the active stack (docs/providers.md). Typed as `api` so the two cannot drift. */
const impl: typeof api =
  authConfig.AUTH_PROVIDER === "supabase" ? supabase : api

export const { fetchSettings, saveSettings } = impl
