<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- **Labs live in the Workshop.** Any lab, playground or sketch tool (for trying effects, styles or motion) gets:
  - its standalone page under `src/app/lab/<name>/page.tsx` (component in `src/components/lab/`), with a link back to its Workshop entry;
  - a Workshop entry page at `src/app/(app)/workshop/<name>-lab/page.tsx` (heading, short description, "Open the …" link);
  - a subsection in `src/lib/domain/sections.ts` (Workshop) and the `"lab"` badge in `src/app/(app)/workshop/page.tsx`.
  Current labs: Cloud lab, Alphabet lab, Orbit sketch.
- **Publishing lore to the live site.** When the GM asks to publish:
  - Run `npm run publish:lore` (rebuilds `fixtures/publication/lore-release.json` from `lore/`, then publishes it), or `npm run publish:bundle -- <bundle.json>` for any other bundle.
  - Both read `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from the session's environment (set in the cloud environment's settings). Never write the key into a file or commit.
  - Publishing validates first, stops on errors, and every release can be rolled back in Workshop → Publishing.
