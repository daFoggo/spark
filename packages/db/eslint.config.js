import globals from "globals"

import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // Node scripts run by the CLI (pgTAP runner).
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
]
