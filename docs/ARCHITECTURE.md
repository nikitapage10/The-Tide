# Architecture handoff

One Next.js 16 (App Router, TypeScript) application. There are no extra services. Supabase provides Postgres, Auth and Storage in connected mode, and a local JSON file stands in for them in demo mode.

## Layers

```
src/lib/contract   Publication contract: Zod schema + types, canonical JSON/hash, URL/Markdown safety.
                   Pure. The only place the bundle format is defined.
src/lib/domain     Business rules, independent of storage and UI:
                   publication.ts (validate → preview → publish/rollback), operations.ts (live records,
                   field ownership, revisions, print rules), queries.ts (relationships, backlinks),
                   search.ts / normalize.ts, sections.ts (five-section map), player-projection.ts (future),
                   ports.ts (storage interfaces), types.ts, errors.ts
src/lib/data       Adapters implementing the ports: memory-store (tests), demo-file-store (local demo),
                   supabase-store (connected), demo-seed (seeds via the real publication service)
src/lib/server     Request plumbing: config.ts (fail-closed mode), context.ts (auth + GM check + wiring),
                   page-context.ts, api.ts/http.ts (CSRF, JSON limits, errors), publisher-auth.ts, supabase.ts
src/app            Routes. (app)/ holds every authenticated page behind one layout; api/v1/ holds the
                   app-owned endpoints; setup/login/forbidden/auth are pre-access pages
src/components     ui/ (tokens-based primitives), shell/ (layout, nav), records/ (published content views),
                   live/ (client forms for operational records), publishing/ (workbench, rollback)
supabase/          SQL migrations (schema, RLS, functions, storage policies) + seed.sql
fixtures/          Seed bundle, example bundle, invalid bundles, demo live data, stable fixture IDs
tests/             unit/ (Vitest), db/ (SQL on local Postgres), e2e/ (Playwright + axe)
contract/          Generated JSON Schema of the bundle
```

The direction of dependencies is `app → components → lib/server → lib/domain → lib/contract`, with `lib/data` implementing `lib/domain/ports`. Client components import only types and pure helpers (`normalize.ts`, `safety.ts`); `server-only` guards the server modules, and a build-time scan checks the browser bundle.

## Request flow

**Read (page):** `(app)/layout.tsx` → `requirePageContext()` → `getAppContext()` (mode, then the Supabase user, then GM membership; or the demo identity in demo mode) → the page reads `ctx.publicationStore.getActiveState()` and the operational lists → pure query helpers → server-rendered HTML. Pages are `force-dynamic`.

**Live mutation:** client form → `fetch` JSON (`src/lib/client/api.ts`) → route handler → `gmMutation()` (origin check, auth, size-limited JSON) → `ctx.operations.*` (strict schema, reference checks, revision CAS) → store → activity event → `router.refresh()`.

**Publication:** workbench → `/api/v1/publications/validate` → `PublicationService.preview` (no writes) → GM confirms → `/publish` → `PublicationService.publish` (idempotency check, validation against the active release, materialized snapshot) → `store.commitRelease` (atomic CAS: Supabase RPC `tide_commit_release`, or the memory store's swap).

## Key design decisions

| Decision | Why | Easy to change? |
| --- | --- | --- |
| Full snapshot per release | Simple, exact rollback; readers switch atomically through one pointer | Yes: could move to deltas behind `PublicationStore` |
| Diff and materialization in TypeScript, CAS in the DB | One implementation shared by demo and Supabase; the DB still guarantees atomicity, idempotency and base checks | Partly |
| Live data in separate tables keyed by stable IDs | Publishing and rollback can never reset or orphan live work | Fundamental |
| Route handlers (not Server Actions) for mutations | Explicit, documented, testable API with uniform auth, CSRF and error codes; the machine publisher shares it | Yes |
| Refetch instead of Realtime | Simpler and reliable for one GM; no channel authorization to get wrong | Yes: add Realtime with RLS later |
| Demo store = JSON file | Runs with zero accounts; survives refresh; clearly not production | n/a |
| System font stacks, CSS-variable tokens | No external services; re-theme in `globals.css` | Yes |
| Section placement derived from `kind`/`format`/`mediaType` | Contract stays UI-agnostic | Yes (`sections.ts`) |

## Extending

- **New entity kind:** add it to `ENTITY_KINDS` (`schema.ts`), place it in a group in `sections.ts`, run `npm run contract:schema`, and update the `record_type` check only if you add a new *record type*.
- **New record type:** add a Zod schema to the union, handle it in `referencesOf`, `recordTitle`, `hrefFor` and search docs, add it to the `record_identities.record_type` check (new migration), and add tests.
- **New live record:** add the type to `types.ts`, a strict input schema and service method in `operations.ts`, port methods, all three adapters, a migration with RLS plus a revision guard, a route and a UI.
- **Player view:** build a new route that uses `projectForPlayers` server-side, with its own auth and RLS (see SECURITY.md).
- **Realtime:** add tables to the `supabase_realtime` publication with RLS-scoped channels, and subscribe in client panels.

## File tree (abridged)

```
├── contract/tide.publication.v1.schema.json
├── docs/                      API, ARCHITECTURE, DATA_MODEL, HANDOFF, IMPLEMENTATION_PLAN,
│                              PUBLICATION_CONTRACT, SECURITY, SUPABASE_SETUP, TEST_REPORT
├── fixtures/
│   ├── ids.json               stable fixture UUIDs (project, seed release, records)
│   ├── live/demo-live.json    demo checklist, notes, prints, builds (all demo: true)
│   └── publication/           seed-release.json, example-minimal.json, invalid/*.json (9)
├── scripts/                   test-db.sh, check-bundle-secrets.mjs, generate-json-schema.ts,
│                              hash-bundle.ts, reset-demo.mjs
├── src/
│   ├── app/
│   │   ├── (app)/             layout (auth gate), page (Home), loading, error, not-found
│   │   │   ├── world/         page, browse/[group], entry/[id]
│   │   │   ├── people/        page, browse/[group], entry/[id]
│   │   │   ├── stories/       page, browse/[group], [id], sessions/[id]
│   │   │   ├── studio/        page, browse/[group], item/[id]
│   │   │   ├── workshop/      page, prints(/[id]), builds(/[id]), publishing, sources, settings
│   │   │   └── search/
│   │   ├── api/v1/            publications/{validate,publish,rollback,releases}, sessions/[id]/state,
│   │   │                      checklist-items(/[id]), gm-notes, print-jobs(/[id](/attempts)),
│   │   │                      builds(/[id](/versions)), assets/[mediaId], demo/reset
│   │   ├── auth/{callback,signout}, login/, setup/, forbidden/
│   │   ├── globals.css        design tokens
│   │   └── layout.tsx
│   ├── components/{ui,shell,records,live,publishing}/
│   ├── lib/{contract,domain,data,server,client}/
│   └── proxy.ts               Supabase session refresh only
├── supabase/migrations/       20261007000001_tide_core.sql, 20261007000002_tide_storage.sql
├── supabase/seed.sql
├── tests/{unit,db,e2e}/
├── .env.example, AGENTS.md (Next.js agent notes), README.md
└── package.json, package-lock.json, next.config.ts, tsconfig.json, eslint.config.mjs,
    vitest.config.mts, playwright.config.ts, postcss.config.mjs
```

## Stack and versions

Next.js 16.4, React 19.3, TypeScript 5.9, Tailwind CSS 4.3, Radix Dialog 1.2, Zod 4.6, react-markdown 10 with rehype-sanitize 6 and remark-gfm 4, @supabase/supabase-js 2.117 with @supabase/ssr 0.12, Vitest 5, Playwright 1.56 with @axe-core/playwright 4.13, ESLint 9 with eslint-config-next 16.4. Exact versions are in `package-lock.json`. Next 16 notes: `middleware` is now `proxy.ts`, `params`/`searchParams` are Promises, and lint runs through the ESLint CLI.
