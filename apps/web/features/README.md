# features/

One folder per business domain (vertical slice). A feature owns its UI, data access,
validation and mutations, and knows nothing about routes.

```
features/<name>/
  components/   UI shared across pages or around the feature
  server.ts     "server-only": the only data calls. PostgREST + RLS via lib/data.
  queries.ts    reads for Server Components (auth via lib/dal, "use cache" here)
  actions.ts    "use server": mutations (validate with Zod, verify session first)
  schemas.ts    Zod schemas + types, usable on client and server
  __tests__/
```

Create only the files a feature needs.

## Reference Implementation

- **`features/auth`**: Complete vertical slice implementation demonstrating authentication actions (`signInAction`, `signUpAction`, `signOutAction`), client form components, schema validation, and session handling.

## Rules (enforced in `eslint.config.js`)

- `features/*` never imports `app/` and never imports another feature (compose in `app/`).
- Same-feature imports are relative; cross-layer imports use `@/`.
- `components/` never imports `server.ts`, `queries.ts`, `lib/dal` or `lib/data`.
- No barrel `index.ts`; import the file you need.

See [docs/project-structure.md](../../../docs/project-structure.md) for the complete architecture guide and package extraction rules.
