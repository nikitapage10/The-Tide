# Implementation plan (as executed)

The brief was revised during the build to use the five-section structure and the "future Earth / planet name undecided" framing. The plan below reflects the final brief.

1. **Contract first.** Define `tide.publication.v1` in Zod (types plus runtime validation), canonical JSON and the SHA-256 bundle hash, and URL/Markdown safety rules. Generate the JSON Schema from it.
2. **Domain services, independent of storage.**
   - Publication: parse → semantic validation (references, duplicates, project, base release, unsafe content) → preview diff → atomic commit through a port → idempotent retries → rollback as a new release.
   - Operations: live-only records with strict ownership schemas, revision CAS, quantity rules for prints and reprints, and an activity log without sensitive text.
   - Read helpers: two-way relationships, backlinks, Unicode-insensitive search, the five-section mapping, and a future player projection.
3. **Adapters.** An in-memory store (tests, fault injection), a local demo file store (seeded through the real publication path), and a Supabase store (RLS-scoped client plus RPCs).
4. **Database.** Migrations with identities, immutable releases and snapshots, separate live tables, no cascades, RLS for GM membership, a SECURITY DEFINER commit function with CAS and audit, storage policies, and a seed for the project row.
5. **Server plumbing.** Fail-closed mode resolution, auth plus GM authorization, origin/CSRF checks, JSON size limits, uniform error codes, and a machine-publisher adapter.
6. **UI.** Token-based design system; an app shell with keyboard-friendly navigation and global search; Home; The World; People & Powers; Stories (stories, story parts, sessions with separated published and live panels); The Studio; The Workshop (print queue, builds, publishing, sources, settings). Loading, empty, error and unavailable states throughout.
7. **Verification.** Vitest (domain, routes, security), SQL/RLS tests on a real local Postgres, Playwright e2e with axe on a production build, and a browser-bundle secret scan.
8. **Docs and handoff.**

## Main design choices (brief, reversible)

- **Five sections from record metadata.** `kind`, `format` and `mediaType` decide where a record appears, so Pages-side authors never need UI knowledge (`src/lib/domain/sections.ts`).
- **Stories as one record type** with `format` (campaign / one-shot / novel / short fiction) and `continuity` (shared canon / story-specific / unknown). Outlines, chapters and scenes are `story_part` records; sessions belong to campaign or one-shot stories.
- **Studio stages** (`inspiration`, `draft`, `approved` = approved visual canon, `final`) keep inspiration separate from canon.
- **Workshop builds are live records**, created and edited in the dashboard, because they track practical work (status, versions, links) rather than authored lore. Artistic direction stays in The Studio as published media.
- **Full snapshots per release** for exact, atomic rollback.
- **Rollback archives newer records** instead of deleting them, so live links never break.
- **The demo store is a local JSON file**, clearly labelled, refused on Vercel and in production builds.
- **Visual direction (proposal):** deep neutral archive palette with restrained teal accents, a serif display face and sans body text from system fonts, faint contour lines, procedural placeholder marks labelled "not canonical art", and no animation beyond colour transitions (disabled under reduced motion).
