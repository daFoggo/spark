import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { jwt } from "better-auth/plugins/jwt"
import pg from "pg"

import { authConfig } from "../config"

const { Pool } = pg

// Undefined on the Supabase stack: the module is still bundled (route handler) but never serves requests.
const cfg = authConfig.AUTH_PROVIDER === "better-auth" ? authConfig : undefined

// Better Auth instance configured for PostgreSQL and JWT plugin
export const auth = betterAuth({
  baseURL: cfg?.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret:
    cfg?.BETTER_AUTH_SECRET ?? "placeholder-secret-at-least-32-characters-long",
  database: new Pool({
    connectionString: cfg?.DATABASE_URL,
    options: "-c search_path=auth",
  }),
  advanced: {
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
      role: { type: "string", defaultValue: "member", input: false },
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
        audience: cfg?.API_AUDIENCE ?? "http://localhost:8000",
        definePayload: ({ user }) => ({
          role: (user as { role?: string }).role ?? "member",
          name: user.name,
          email: user.email,
        }),
      },
    }),
    nextCookies(),
  ],
})
