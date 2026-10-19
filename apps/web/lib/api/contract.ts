import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { parse } from "yaml"

import type { components } from "./schema"

/** Type-level equality: compile fails when the Zod DTO and the generated contract type drift. */
export type Same<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
export type Schemas = components["schemas"]

type Contract = {
  components: {
    schemas: Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >
  }
}

const contract = parse(
  readFileSync(
    resolve(process.cwd(), "../../docs/goals-habits/openapi.yaml"),
    "utf8"
  )
) as Contract

/** Property names of an object schema in `openapi.yaml`, for the runtime half of the drift tests. */
export function contractKeys(schema: string): string[] {
  return Object.keys(
    contract.components.schemas[schema]?.properties ?? {}
  ).sort()
}

export function contractRequired(schema: string): string[] {
  return [...(contract.components.schemas[schema]?.required ?? [])].sort()
}
