import { nextJsConfig } from "@workspace/eslint-config/next-js"

const layerRestrictions = [
  {
    group: ["@/app", "@/app/**"],
    message: "features/ must not import from app/.",
  },
  {
    group: ["@/features", "@/features/**"],
    message:
      "Features must not import other features. Compose them in app/, and use relative imports inside a feature.",
  },
]

const featureRestrictions = [
  ...layerRestrictions,
  {
    group: ["**/server.api", "**/server.supabase"],
    message:
      "Import ./server: it picks the data path of the active stack (docs/providers.md).",
  },
]

const authRestrictedGroup = ["@/lib/auth", "@/lib/auth/**", "@/lib/env"]

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: featureRestrictions }],
    },
  },
  {
    // The selector is the one file that imports both data paths.
    files: ["features/*/server.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: layerRestrictions }],
    },
  },
  {
    // Declared after the block above so this rule set replaces it for components/.
    files: ["features/*/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...featureRestrictions,
            {
              group: [
                "**/server",
                "**/server.*",
                "**/queries",
                "@/lib/dal",
                "@/lib/http",
                "@/lib/supabase/data",
                ...authRestrictedGroup,
              ],
              message:
                "Feature components must not import server-only modules (server, queries, dal, http, auth).",
            },
          ],
        },
      ],
    },
  },
  {
    // App shell components may be client components; auth config holds secrets.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/dal",
                "@/lib/http",
                "@/lib/supabase/data",
                ...authRestrictedGroup,
              ],
              message:
                "Shared components must not import server-only modules (dal, http, auth).",
            },
          ],
        },
      ],
    },
  },
]
