# Security model

> **Current setting: public, read-only viewing is ON** for The Tide (requested by the GM). Anyone can view published lore and live status without signing in; GM notes, the publication audit and private assets stay private; every change, publish and rollback still requires the GM account. Turn it off with `update public.projects set public_read = false where id = '333ea628-f6a1-4f3a-8b83-ce98d12f2565';` (migration `20261007000003_tide_public_read.sql`). GM access is granted through `project_invites` (migration `…000004`): an invited email becomes GM on its first sign-in.

The MVP is private and GM-first. Hiding a button is never treated as access control.

## Access control

| Layer | Enforcement |
| --- | --- |
| Pages | `requirePageContext()` resolves the mode, verifies the Supabase user with `auth.getUser()` and requires `project_members.role = 'gm'`; otherwise it redirects to `/setup`, `/login` or `/forbidden`. The `(app)` layout runs this before rendering anything. |
| API | `requireApiContext()` (same checks, returning 401/403/503), plus origin checks and strict input schemas. |
| Database | RLS on every table using `tide_is_gm(project_id)`. Published tables are read-only to API roles, and the publish RPC re-checks membership. Composite FKs stop cross-project references. |
| Storage | Private bucket; policies require GM membership of the project named by the first path segment. Signed URLs last 60 seconds, are issued per request, and are never stored. |
| Proxy (`src/proxy.ts`) | Only refreshes the session cookie. It makes no authorization decisions. |

Verified with SQL tests against local Postgres (stubbed `auth.uid()`): anon reads nothing; a GM of another project and an authenticated non-member read and write nothing in project A; direct writes to published tables are refused; immutability triggers hold even for the table owner. See [TEST_REPORT.md](TEST_REPORT.md) for exactly what was and was not run.

## Fail-closed configuration

- `TIDE_DATA_MODE` unset or unknown → setup-required.
- Demo mode is refused on Vercel (`VERCEL`/`VERCEL_ENV` set) and in production builds unless `TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD=true` is set explicitly (meant for local e2e only).
- Supabase mode with missing settings → setup-required, listing variable *names* only. It never silently falls back to demo.
- The demo identity exists only in the demo branch of `getAppContext()`; the Supabase branch only accepts a verified Supabase user.

## Secrets

- Only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key reach the browser. The secret key (`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) is read only in `src/lib/server/supabase.ts` (`server-only`) and used only for the machine publisher.
- The publisher token is never stored; only its SHA-256 is configured, and comparison is constant-time.
- `npm run check:bundle-secrets` scans `.next/static` after a build made with sentinel values. It last passed with no leaks.
- Logs record error codes only, never request bodies, note text, tokens or URLs. Activity summaries never contain GM note text.
- `.env*` files are git-ignored. `.env.example` contains placeholders only.

## CSRF and HTTP

- Mutations are POST/PATCH/DELETE only (GET returns 405).
- Cookie-authenticated mutations need an `Origin` that matches the app's origin and, when present, `Sec-Fetch-Site: same-origin`. JSON-only bodies force a CORS preflight for cross-site attempts. Supabase cookies are `SameSite=Lax` by default.
- All responses: `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. Pages are rendered dynamically and never statically cached.

## Untrusted imported content

- Bundles are validated in full (size, structure, references, URL protocols, dangerous Markdown) before anything is written.
- Markdown is rendered with react-markdown **without** raw HTML, plus `rehype-sanitize` and a URL allowlist (`http(s)`, `mailto`, relative). External links get `rel="noopener noreferrer nofollow"`. Remote images are **not** auto-loaded; they render as links, which avoids tracking pixels.
- The server never fetches supplied URLs.

## Search, caches and payloads

- Search runs server-side after authorization, over the active release, print jobs and builds. GM notes are not indexed. There is no client-side search index.
- API responses return only what the caller already has access to. The note-creation response returns only the new note's ID and timestamp.

## Future player-safe view (designed, not built)

`src/lib/domain/player-projection.ts` (unit-tested, used by no route) shows the intended approach: a **server-side allowlist** projection that keeps only `player_safe`, active, non-demo records. It drops session prep, source references, conflicts, private assets, GM notes and any relationship whose ends or itself are not player-safe. Marking a record `player_safe` does not publish it; a future sharing feature would still need its own authenticated route, its own RLS (or a security-definer view) and an explicit enable step. A client-side "show secrets" toggle must never be used.

## Known gaps

- Rate limiting is not implemented (Supabase Auth limits sign-in emails; consider Vercel or WAF rules before exposing machine publishing).
- There is no Content-Security-Policy header yet (inline styles from Next/Tailwind need nonce work). It is listed in HANDOFF.
- The Supabase adapter and auth flow have not been exercised against a hosted project.
