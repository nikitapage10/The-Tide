# Handoff: features, deferrals, known issues, assumptions

## Implemented

- **GitHub Actions:** `CI` (lint, types, unit, SQL/RLS, build, bundle scan, e2e) on every push/PR; `Supabase migrations` applies migrations + seed to the hosted database from the default branch (needs the `SUPABASE_DB_URL` secret; optional `TIDE_GM_EMAIL` grants GM).

- **Visual direction (v2, from the GM's mockup):** monochrome observatory look; full-screen home hero where you land among meteors, scrolling pulls the camera back (meteors fly outward, the planet is revealed, callouts and glyphs fade in behind the meteors); a minimal gravity-lens flare that appears only while the pointer moves; transparent header with World / People / Stories / Studio / Workshop; hero artwork in `public/brand/` (supplied by the GM), reference mockup in `docs/design/`.

- **Five sections plus Home** with shared navigation, nested subpages, global search and contextual cross-links:
  - *The World*: environments, places, history & events, technology, relics, phenomena, how the world works, concepts & names. Filterable by text, category, tag, canon status and archived state.
  - *People & Powers*: peoples (the eight established peoples), characters, creatures, factions, institutions; two-way relationship lists; "appears in" backlinks to stories and sessions.
  - *Stories*: campaigns, one-shots, novels, short fiction; story parts (outline/chapter/scene) with viewpoint characters and draft status; continuity badge (shared canon vs story-specific); sessions with **separate** published (prep, recap) and live (status, scheduled date, actual run date, checklist, GM notes, linked prints) panels.
  - *The Studio*: music, artwork, artistic elements, aesthetics, branding and design, document; stages inspiration/draft/approved/final; external links (never auto-loaded) and private asset references (signed-URL route); links to entries, stories and sessions.
  - *The Workshop*: print queue (create/edit, statuses, priority, optional metadata, attempts for retries and reprints), builds (physical/code/logic/dashboard; links, versions, related lore), publishing, sources, connection & settings.
- **Home:** intro with the planet name marked undecided; section shortcuts; next scheduled session, open prep items, prints in progress, recent live activity, latest release; unresolved lore (chronology question, undecided planet name, unsupplied cycle definitions).
- **Publication contract and workflow:** Zod schema plus generated JSON Schema; canonical hash; validation; preview; explicit publish; idempotent retries; stale-base and release-ID conflicts; atomic commit; audit trail; rollback as a new release; archive, restore and confirmed tombstone; fixtures (seed, example, 9 invalid).
- **Data and security:** stable UUID identities; separate live tables; field-ownership enforcement in code and schema; revision checks; Supabase migrations with RLS, a commit RPC, immutability triggers and storage policies; fail-closed configuration; CSRF and origin checks; sanitized Markdown; a machine-publisher adapter (hashed bearer token).
- **Demo mode:** seeded through the real publication path; file persistence; reset control; visible demo labels everywhere (`demo: true` on every fixture).
- **Tests:** 92 unit/route tests, 33 SQL checks, 8 e2e scenarios with axe, and a bundle secret scan. See TEST_REPORT.md.

## Deliberately deferred (no placeholder buttons exist for these)

- Space Pages / ChatGPT integration of any kind (no verified API). Publication is manual import or the documented machine endpoint.
- Player sharing / player-safe view (only the server-side projection design and tests exist).
- Realtime subscriptions (pages refetch after changes).
- Editing or deleting GM notes (append-only for now); deleting print jobs or builds (use the `canceled` / `abandoned` status).
- Uploading assets from the dashboard (upload via the Supabase dashboard; the app only issues signed read URLs).
- Graph visualization of relationships (an accessible list is provided); maps of any kind.
- Membership management UI (SQL only), multi-project switching, billing.
- Light theme (tokens make it a small change), Content-Security-Policy header, rate limiting.
- Virtual tabletop, combat, character builder, slicer or printer control (out of scope by design).

## Known issues and limitations

- Connected mode (Supabase adapter, Auth, Storage) is implemented but **unverified against a live Supabase project**. Expect possible small fixes on first connection (e.g. row mapping).
- Search loads the active snapshot in memory per request. That is fine for a single private project with hundreds or low thousands of records; add Postgres full-text search later if it grows.
- Each release stores a full snapshot, so storage grows linearly with releases × records (acceptable at this scale).
- `npm audit` reports a dev-only `braces` advisory via the Next ESLint config (no runtime impact).
- Dates in the UI are shown in UTC; "next scheduled session" compares against the server's UTC date.
- Demo persistence is per machine and per file; running several demo servers on the same file is not supported.
- Playwright is pinned to 1.56 to match the Chromium available in the build environment; a newer Playwright works with `npx playwright install chromium`.
- `AGENTS.md` is generated by `next dev` (Next.js agent notes). It is kept because Next re-adds it.

## Assumptions

- One private project and one GM role. "GM" is the only authorization level; all members are GMs.
- Magic-link email sign-in is acceptable for the GM (no password UI).
- Sessions belong to campaign or one-shot stories. Workshop builds are operational, not authored lore.
- `visibility` defaults to `gm_only`; nothing is player-visible.
- The project UUID `333ea628-f6a1-4f3a-8b83-ce98d12f2565` from the fixtures may be used for the real project. It is an identifier, not a secret.
- Status lists (print, session, build, draft) are proposed defaults; they are enums in `types.ts`/`schema.ts` plus SQL check constraints.
- The two Google Drive PDFs were **not accessed**. They are recorded as `source` records with `documentId` taken from their URLs, and title, revision and hash are null.

## Manual setup still required

1. Create the Supabase project, apply the migrations, run `seed.sql` and configure Auth redirect URLs ([SUPABASE_SETUP.md](SUPABASE_SETUP.md)).
2. Invite yourself and insert your `project_members` row.
3. Set environment variables locally and on Vercel; deploy when ready.
4. Publish `fixtures/publication/seed-release.json` (then archive the demo records when you no longer want them).
5. Optionally configure the machine publisher (token hash plus secret key).
6. Run the connected-mode manual checklist in [TEST_REPORT.md](TEST_REPORT.md).

## Suggested next steps

1. Connect Supabase and run the connected checklist; fix any adapter mismatches.
2. Map Space Pages sections to stable record IDs (keep the mapping alongside the Pages export process).
3. Produce the first real bundle from the PDFs, once their content is supplied, with `sourceRefs` locators.
4. Decide the art direction; adjust tokens in `src/app/globals.css`.
5. Add CSP, rate limiting and CI.
