/** Postgres error codes that mean "the request was rejected", as opposed to a bug or an outage. */
const EXPECTED_PG_CODES = new Set(["23505", "23514", "23503", "P0001", "42501"])

/** Error from a Supabase (PostgREST) call: `code` is the Postgres or PostgREST code. */
export class DataError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "DataError"
  }

  /** A rule violation the user can act on (duplicate, check, RLS), safe to show in a form. */
  get expected(): boolean {
    return EXPECTED_PG_CODES.has(this.code)
  }
}

/**
 * The request was understood and rejected (validation, conflict, rule): an expected Postgres code.
 * Actions return it as a value. Anything else, including Next's `redirect()`/`notFound()` signals,
 * must be rethrown.
 */
export function isExpectedDataError(error: unknown): error is DataError {
  return error instanceof DataError && error.expected
}

/** The spec rule that refused a write (e.g. `TM-2`), from the message prefix. */
export function ruleOf(error: DataError): string | undefined {
  return /^([A-Z]{2}-\d+):/.exec(error.message)?.[1]
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Throws a `DataError` for a failed Supabase call; otherwise returns the (non-null) data. */
export function unwrap<T>(result: {
  data: T
  error: { code: string; message: string } | null
}): NonNullable<T> {
  if (result.error) {
    throw new DataError(result.error.code, result.error.message)
  }
  if (result.data === null || result.data === undefined) {
    throw new DataError("PGRST116", "No data returned")
  }
  return result.data
}
