# Caching & Lifetimes (`"use cache"`)

## 1. When to Use
Use when caching data functions or components across requests or sessions.

## 2. Decision Matrix

| Data Scope | Directive & Profile | Key & Tag Rules |
| :--- | :--- | :--- |
| **Shared Data** (categories, articles) | `"use cache"` + `cacheLife("hours")` | Key = arguments. `cacheTag("resource")`. |
| **Per-User Data** (profile, settings) | `"use cache: private"` + `cacheLife({ stale: 300, revalidate: 300, expire: 3600 })` | Browser-only. `cacheTag("resource:userId")`. |
| **Distributed Remote** (expensive queries) | `"use cache: remote"` + `cacheLife("hours")` | Shared Redis cache. Key on low-cardinality values only. |

## 3. Canonical Patterns

```ts
// Shared data pattern: features/<domain>/queries.ts
export async function getCategories() {
  "use cache"
  cacheLife("hours")
  cacheTag("categories")
  return fetchCategories()
}

// Per-user data pattern: features/<domain>/queries.ts
export async function getUserSettings() {
  "use cache: private"
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 })
  const { accessToken, userId } = await verifySession()
  cacheTag(`settings:${userId}`)
  return fetchUserSettings(accessToken)
}
```

## 4. Never Do
- ❌ **Never omit `cacheLife()`**: Without it, nested caches silently override lifetimes.
- ❌ **Never pass secrets or tokens into `"use cache"` arguments**: Keys are stored in plain text.
- ❌ **Never use `connection()` inside `"use cache: private"`**: Use `await io()` instead.
- ❌ **Never `await io()` outside a cache scope before per-user reads**: everything after it leaves the App Shell, so every navigation waits for the server. A request-time value those reads need (today's date) is `"use cache: private"` itself (`getToday` in `lib/clock.ts`).
- ❌ **Never rely on `React.cache` to dedupe a read that private caches call**: each cache scope has its own `React.cache`. Make the shared read `"use cache: private"` (the DAL's `getSession`): one read per request instead of one per query.
- ❌ **Never link to a page that reads `searchParams` / `params` without considering `prefetch`**: URL data is not in the shared App Shell. Use `<Link prefetch>` where the wait matters (sidebar: `prefetch: true` in `config/navigation.ts`; list → detail links like `/dashboard/goals/[goalId]`).
- ❌ **Never use legacy Next 14 configs**: `revalidate`, `dynamic`, `fetchCache`, and `unstable_cache` fail with Cache Components.

## 5. Source of Truth (Deep Dive)
- Cache keys, cacheLife profiles, and invalidation: [docs/data-fetching.md §5](../../../../docs/data-fetching.md#5-caching)
- Redis CacheHandler setup: [docs/advanced-patterns.md §2](../../../../docs/advanced-patterns.md#2-distributed-remote-cache-cachehandlers--redis--upstash)
