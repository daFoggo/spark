import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { jwt } from "better-auth/plugins/jwt"
import pg from "pg"

import { authConfig } from "../config"
import type { AuthOptions } from "../types"
import { BETTER_AUTH_DEFAULT_ROLE, jwtPayload } from "./payload"

const { Pool } = pg

// Undefined on the Supabase stack: the module is still bundled (route handler) but never serves requests.
const cfg = authConfig.AUTH_PROVIDER === "better-auth" ? authConfig : undefined

function create(options: AuthOptions) {
  return betterAuth({
    baseURL: cfg?.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret:
      cfg?.BETTER_AUTH_SECRET ??
      "placeholder-secret-at-least-32-characters-long",
    database: new Pool({
      connectionString: cfg?.DATABASE_URL,
      options: "-c search_path=auth",
    }),
    advanced: {
      // Per-app cookies keep sessions of different apps apart on one host.
      cookiePrefix: options.cookieName,
      database: { generateId: "uuid", validateSchema: false },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    trustedOrigins: cfg?.BETTER_AUTH_URL
      ? [cfg.BETTER_AUTH_URL]
      : ["http://localhost:3000"],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: 6,
      maxPasswordLength: 128,
    },
    socialProviders:
      cfg?.GOOGLE_CLIENT_ID && cfg?.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: cfg.GOOGLE_CLIENT_ID,
              clientSecret: cfg.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: BETTER_AUTH_DEFAULT_ROLE,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [
      jwt({
        jwt: {
          issuer: cfg?.BETTER_AUTH_URL ?? "http://localhost:3000",
          definePayload: ({ user }) =>
            jwtPayload(user as { role?: string; name: string; email: string }),
        },
      }),
      nextCookies(),
    ],
  })
}

export type BetterAuth = ReturnType<typeof create>

const instances = new Map<string, BetterAuth>()

/** Better Auth instance (PostgreSQL + JWT plugin) for one app, created once per cookie name. */
export function getBetterAuth(options: AuthOptions): BetterAuth {
  let instance = instances.get(options.cookieName)
  if (!instance) {
    instance = create(options)
    instances.set(options.cookieName, instance)
  }
  return instance
}
