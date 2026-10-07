# Test report

Environment: Linux container, Node 22.22, npm 10.9, PostgreSQL 16 server binaries (no Docker daemon), Playwright 1.56 with preinstalled Chromium build 1194. Run on 2026-10-07 against commit `HEAD` of branch `claude/lucid-mccarthy-493lvy`.

## Summary

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **Passed** (0 errors, 0 warnings) |
| Type check | `npm run typecheck` | **Passed** |
| Unit, domain and route tests | `npm test` | **Passed**: 92 / 92 tests in 7 files |
| SQL / RLS / function tests | `npm run test:db` | **Passed**: 33 / 33 checks (local Postgres 16 with a stub Supabase `auth`/`storage` schema) |
| Production build | `npm run build` | **Passed**; every private route is dynamic (`ƒ`) |
| Browser-bundle secret scan | build with sentinel secrets, then `npm run check:bundle-secrets` | **Passed**: 24 client files, 8 markers, no leaks |
| E2E + accessibility | `npm run build && npm run test:e2e` | **Passed**: 8 / 8 scenarios; axe (WCAG 2.1 A/AA) finds no serious or critical violations on Home, entry detail, session, print job, publishing and Studio (mobile) |
| Dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** in runtime dependencies. Full `npm audit` reports 5 high findings from one advisory (`braces` via `eslint-config-next` → `fast-glob`, dev-only lint tooling); no patched version is available without downgrading the Next ESLint config |

**Failed:** none in the final run. Failures found during development were fixed before it. Real bugs fixed: a demo-store reseed race under concurrent reads; a checklist checkbox that did not respond until the server answered (now optimistic, with rollback on error); open-question titles that were not headings; an unlabelled hidden file input on the publishing page (found by axe). Some test locators were also made exact.

## Unrun or not verified

| Item | Why | How to run later |
| --- | --- | --- |
| `SupabaseStore` against a real Supabase (PostgREST, RPC calls, row mapping) | No Supabase project or Docker here | `npx supabase start`, set env to the local stack, run the app and the manual checklist below |
| Supabase Auth magic link, `/auth/callback`, cookie refresh in `proxy.ts` | No hosted Auth | Manual checklist |
| Storage signed URLs and storage RLS in the real Storage API | Storage API not available; policies were tested only as SQL against a stub `storage.objects` | Upload a file and open it as a GM and as a non-member |
| RLS through PostgREST with real JWTs | SQL tests simulate `auth.uid()` with `request.jwt.claims` | `supabase test db`, or the manual checklist |
| Vercel deployment | Not deployed (by instruction) | README → Deploying |
| Machine publisher against Supabase with `SUPABASE_SECRET_KEY` | No project | `curl` example in API.md |
| Other browsers (Firefox, Safari) and real screen readers | Only Chromium available | Manual |

The demo-mode and stub-based results do **not** prove production security. The DB tests show that the SQL policies and functions behave as designed on Postgres; the hosted stack still needs the manual checks below.

## What the automated tests cover (mapped to the acceptance criteria)

- **Search, filters, relationships, Unicode:** `search.test.ts` (Teruanga→Teruānga, nythrok/Nyth'rok→Nyth’rok, Primus alias, archived ranking, GM notes not indexed, two-way relationships, backlinks); e2e "filters and two-way relationship navigation", "keyboard … search".
- **Title update keeps ID, references and live work:** `publication.test.ts` "a title change keeps…"; e2e publishing (renamed faction keeps its URL/ID); SQL "renaming keeps a single stable identity".
- **Valid import, invalid schema, bad references, duplicate IDs, unsafe content:** `contract.test.ts` (9 invalid fixtures, each with a specific code; size limit; bad JSON; unknown fields; ID format; hash mismatch).
- **Preview without mutation, idempotent retry, ID/content conflict, stale base, transactional failure:** `publication.test.ts` (whole store compared before and after preview; replay; conflict; stale; fault injection before activation leaves no release and an unchanged active pointer); SQL equivalents; route test validate→publish→replay.
- **Archive, preserved live references, rollback keeps live work:** `publication.test.ts` (archive keeps links; rollback restores lore as version 3, archives newer records, keeps tombstones, and leaves checklist, print, session state and notes byte-identical); SQL "publish + rollback leave live records byte-identical"; e2e rollback scenario.
- **Authentication and authorization failures, unrelated user/project, source-owned and unauthorized fields:** `routes.test.ts` (401 without session, 403 non-GM, setup-required 503, CSRF 403, bearer refused on rollback, machine token checks, `FIELD_NOT_ALLOWED`); `operations.test.ts`; SQL (anon, other-project GM, non-member, direct writes to published tables, cross-project references, immutability).
- **No service credential in the browser bundle, no leaks through search, assets, caching or payloads:** bundle scan; route tests (`no-store`, assets 503 in demo with no redirect, no stack traces); activity never contains note text; search excludes notes; e2e checks `cache-control`.
- **No production demo bypass, missing configuration:** `security.test.ts` (unset, unknown, Vercel, production build, half-configured Supabase); route tests (503 with no data).
- **Keyboard, small screens, focus, empty/error/loading states, accessibility:** e2e (skip link first and focus visible; dialog Escape returns focus; 360 px with no horizontal overflow; mobile menu; empty search, unknown record, unavailable asset); axe on six pages.

## Manual checklist (≈15 minutes)

Demo mode (`npm run demo`):
- [ ] Banner says local demo mode; Settings shows "Demo mode (local only)" and integrations as not connected.
- [ ] Tab from the address bar: the "Skip to content" link appears; every control shows a visible focus ring.
- [ ] Search `teruanga`, `primus`, `nythrok`: the right entries appear.
- [ ] People & Powers → Peoples shows exactly eight entries, each saying source material has not been supplied.
- [ ] Teruānga → Future Earth → the list of peoples shows all eight; back navigation works.
- [ ] Demo session 1: change status and dates, add/tick/rename/remove a prep item, add a GM note; Home updates (next session, open prep, activity). The GM note text never appears in activity.
- [ ] Open the same session in two tabs, tick an item in one, then rename it in the other: a conflict message with Reload appears.
- [ ] Print queue: create a job with requested 0 (inline error), then 3; record 1 failed and 5 succeeded (actionable error); the requested quantity stays 3.
- [ ] Publishing: insert example → preview (nothing changes yet) → publish → version 2; publish the same text again → "Already published"; roll back to version 1 → version 3; live changes are still there.
- [ ] Paste `fixtures/publication/invalid/unsafe-content.json`: errors listed and Publish disabled.
- [ ] Phone width (≈375 px): Menu & search works; no sideways scrolling; dialogs fit.
- [ ] OS "reduce motion" on: nothing animates.
- [ ] Reset demo data restores the fixtures.

Connected mode (after SUPABASE_SETUP.md):
- [ ] With env missing, `/` redirects to Setup required (no demo data).
- [ ] Not signed in: `/` → `/login`; `GET /api/v1/publications/releases` → 401.
- [ ] Signed in as a non-member: `/forbidden`; API 403.
- [ ] As GM: publish the seed bundle; all sections populate; live edits persist across devices.
- [ ] In the Supabase SQL editor, as an authenticated non-member (or via the REST API with their JWT): selects on `release_records` / `gm_notes` return 0 rows; inserts into `releases` fail.
- [ ] Private asset opens for the GM through a short-lived URL; the same object URL fails for others.
- [ ] Redirect URLs are correct for localhost and the production domain.
