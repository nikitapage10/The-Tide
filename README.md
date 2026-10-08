# The Tide — dashboard

A private worldbuilding, storytelling and creative project dashboard for **The Tide**, a homebrew sci-fi Daggerheart setting on a transformed future Earth (planet name undecided).

The dashboard has five sections (**The World**, **People & Powers**, **Stories**, **The Studio**, **The Workshop**) plus Home, global search and a GM-only publishing workflow.

```
ChatGPT conversation + Space Pages (authoring, authoritative)
        │  deliberate, reviewable publication (JSON bundle, tide.publication.v1)
        ▼
Supabase: immutable published releases  +  separate live/operational records
        ▼
Next.js dashboard (Vercel)
```

**Status of integrations:** no Supabase project, Vercel deployment, Space Pages API or ChatGPT connection has been set up. Out of the box the app runs in an explicit **local demo mode**; connected mode is implemented and documented but has **not** been run against a real Supabase project. See [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Prerequisites

- Node.js **20.9+** (developed on 22.x) and npm 10+
- For connected mode: a Supabase project (free tier is fine)
- Optional, for `npm run test:db`: PostgreSQL 15+ server binaries (`initdb`, `pg_ctl`, `psql`) on PATH or in `PGBIN`
- Optional, for `npm run test:e2e`: a Playwright Chromium (`npx playwright install chromium`)

## Quick start (local demo)

```bash
npm ci
npm run demo          # = TIDE_DATA_MODE=demo next dev
# open http://localhost:3000
```

Demo mode uses seeded fixtures and a local file store (`.tide-demo/state.json`, git-ignored). Changes survive page refreshes and dev-server restarts. Reset with **The Workshop → Connection & settings → Reset demo data**, `npm run demo:reset`, or by deleting the file. Demo mode is a local tool only: it is refused on Vercel and in production builds unless you explicitly set `TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD=true` for a local test.

Things to try: search for `teruanga` or `primus`, filter People & Powers by tag, follow relationships, tick prep items and set a date on **Stories → Demo campaign → Demo session 1**, create a print job and record a failed reprint, then go to **The Workshop → Publishing**, insert the example bundle, preview it, publish it and roll it back.

## Connected mode (Supabase)

Full steps: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). In short:

```bash
cp .env.example .env.local              # set TIDE_DATA_MODE=supabase + Supabase URL/key + TIDE_PROJECT_ID
npx supabase link --project-ref <ref>   # or paste the SQL files into the SQL editor
npx supabase db push                    # applies supabase/migrations/*
# run supabase/seed.sql, invite yourself in Supabase Auth, add yourself to project_members
npm run dev
# sign in, then publish fixtures/publication/seed-release.json in The Workshop → Publishing
```

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Local demo | `npm run demo` |
| Dev server (uses `.env.local`) | `npm run dev` |
| Production build / start | `npm run build` / `npm start` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Unit + route tests (Vitest) | `npm test` |
| SQL / RLS tests (local Postgres) | `npm run test:db` |
| E2E + accessibility (Playwright + axe; build first) | `npm run build && npm run test:e2e` |
| Scan browser bundle for secrets (after a build) | `npm run check:bundle-secrets` |
| Regenerate JSON Schema from the contract | `npm run contract:schema` |
| Validate a bundle and print its hash | `npm run contract:hash -- path/to/bundle.json` |
| Reset local demo data | `npm run demo:reset` |

If Chromium is preinstalled elsewhere, run e2e with `PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

## Deploying to Vercel (when you are ready)

Nothing has been deployed. When you choose to:

1. Complete the Supabase setup and confirm connected mode works locally.
2. Import the repository in Vercel (framework preset: Next.js; build command `npm run build`).
3. Set environment variables for Production (and Preview if used): `TIDE_DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `TIDE_PROJECT_ID`. Add `SUPABASE_SECRET_KEY` and `TIDE_PUBLISHER_TOKEN_SHA256` only if you enable the machine publisher. Never prefix secrets with `NEXT_PUBLIC_`.
4. In Supabase Auth → URL configuration, set the Site URL to your Vercel domain and add `https://<your-domain>/auth/callback` to the redirect allow list.
5. Deploy. If any setting is missing the app shows **Setup required** rather than demo data.

## Documentation

- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md): the plan and the main design choices
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture handoff, request flow, file tree, how to extend
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md): field ownership, stable IDs, releases and rollback, adapters
- [docs/PUBLICATION_CONTRACT.md](docs/PUBLICATION_CONTRACT.md): JSON contract, canonical hash, authoring guide, publisher integration
- [docs/API.md](docs/API.md): endpoints, authentication, error codes
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): database, auth, storage, redirect URLs
- [docs/SECURITY.md](docs/SECURITY.md): access control, secrets, untrusted content, future player view
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md): what was run (passed / failed / unrun) and the manual checklist
- [docs/HANDOFF.md](docs/HANDOFF.md): features, deferrals, known issues, assumptions, manual setup

## Canon policy

Only the facts in the GM brief are seeded as canon: the project name, a transformed future Earth with a planet named Ilyr (ih-LEER, from the Teruānga for “light that remains”; “Primus” was the working name), cataclysms, seven cycles, the names Drowning / Divergence / Drift, the eight peoples (Blightmourn, Irridosai, Nyth’rok, Obscarron, Resonara, Syntherion, Teruānga, Umbrasa), and the unresolved Undertow / Age of the Abyssal Veil / The Tide question. Everything else is a clearly labelled demo record (`demo: true`, `canonStatus: "non_canon"`). The two Drive PDFs are recorded as source references only; they were not read, and their titles, revisions and hashes are left empty.
