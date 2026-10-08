# Content pipeline: from the ChatGPT spaces to the site

Lore is written in ChatGPT and published here automatically, by a custom GPT that calls the site's publishing API. Nothing reaches the site except through a validated **publication bundle** (`docs/PUBLICATION_CONTRACT.md`). Every publish becomes a numbered release in the Workshop, and the GM can roll any of them back in one click.

```
ChatGPT project spaces           The Tide Publisher (custom GPT)              The site
World · People · Stories ──▶     reads the active release and the index  ──▶ /api/v1/publications/validate
Studio · Workshop                builds a bundle, validates, fixes, then      /api/v1/publications/publish
(where you write)                publishes                                    → a new release, live at once
```

## Why a custom GPT

ChatGPT *projects* (your spaces) cannot call outside APIs; only a **custom GPT with an Action** can. So the setup is one GPT, "The Tide Publisher", with:
- the instructions in [`docs/gpt/publisher-instructions.md`](gpt/publisher-instructions.md);
- the Action imported from the site's OpenAPI document;
- the mapping in [`docs/gpt/spaces.md`](gpt/spaces.md) as its knowledge.

You keep writing in your spaces. When something is ready, publish it in one of two ways:
- **Hand it over.** Paste the finished text, or upload the document, into a conversation with The Tide Publisher, and say which space it belongs to ("Publish this to People").
- **Use it inside the space.** If your ChatGPT plan lets you use a custom GPT inside a project, do that, so the space's own files are at hand.

## One-time setup

1. **Deploy the site in Supabase mode.** See `docs/SUPABASE_SETUP.md`.
2. **Make a publisher token.** It is a long random secret:
   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
   Keep it somewhere safe; you will paste it into the GPT.
3. **Give the server its hash, never the token itself.** In Vercel → Project → Settings → Environment Variables:
   - `TIDE_PUBLISHER_TOKEN_SHA256` = the hex SHA-256 of the token:
     ```sh
     node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" '<token>'
     ```
   - `SUPABASE_SECRET_KEY` = the project's secret key (server only).

   Redeploy.
4. **Create the GPT** (ChatGPT → Explore GPTs → Create → Configure):
   - **Name:** The Tide Publisher.
   - **Instructions:** paste [`docs/gpt/publisher-instructions.md`](gpt/publisher-instructions.md) (everything below its first heading).
   - **Capabilities:** turn on *Code Interpreter* (the GPT computes stable IDs with Python's `uuid.uuid5`).
   - **Knowledge:** upload [`docs/gpt/spaces.md`](gpt/spaces.md) and [`docs/PUBLICATION_CONTRACT.md`](PUBLICATION_CONTRACT.md).
   - **Actions → Create new action → Import from URL:** `https://<your site>/api/v1/openapi.json`.
   - **Authentication:** API Key, Auth Type *Bearer*, and paste the token.
   - **Privacy policy:** your site's URL is enough for a private GPT.
   - **Visibility:** keep the GPT private ("Only me").
5. **Test it.** Ask the GPT to *"check the connection"*. It should call `getActiveRelease` and report the release number.

## What the publisher may and may not do

| Allowed | Not allowed (refused by the server) |
| --- | --- |
| Add records, update them (it reads the current version first), archive and restore them | **Tombstone** (permanent deletion): that stays a GM action in the Workshop |
| Validate any number of times | More than 60 requests in 10 minutes (stops a runaway loop) |
| Publish a validated bundle | Roll back, or touch live data (sessions, prep, prints, notes) |

Every release shows in **Workshop → Publishing** with what changed. Roll back from there; a rollback is itself a new release, so nothing is lost.

## Stable identities

Each thing has one ID forever. The publisher derives it from a stable name, `<area>/<slug>`, for example `people/teruanga`, `faction/nagga-kai` or `event/the-first-ascent`. The ID is a UUIDv5 of the project ID and that name (`src/lib/contract/ids.ts`), so the same name always gives the same ID and re-publishing updates rather than duplicates.

Records that existed before this scheme keep their IDs: the eight peoples, the Drowning, the Divergence, the Drift and a few others. The publisher finds those with `listRecords` and reuses them.

## How content becomes pages

| You write… | It becomes… | And appears… |
| --- | --- | --- |
| a people, in the template (Origins, the Age of the Abyssal Veil, Impact of the Tide's Three Consequences, Today, Anatomy, Behavior, Unique Abilities, Reproduction, Habitat) | `entity` `kind: people`, body with those `##` headings, `palette` | People: a portrait plate in the hall; a folio with a section rail |
| an enclave (About, History) | `entity` `kind: people`, tag `enclave`, `era: tide` | People → Arrivals |
| a faction or order | `entity` `kind: faction` or `institution`, `parentId` = its people, plus a "Faction of" relationship | in its people's folio, and the constellation |
| an event or an age | `entity` `kind: event` or `history`, `era`, `chronology.sortKey` | World: on the timeline river; its page shows what came before and after |
| a place | `entity` `kind: place`, `parentId`, optionally `location` | World: the atlas (charted with a location, otherwise in the uncharted margin) |
| a phenomenon, technology, relic or concept | its `kind` | World pages and the index |
| a story, chapter or session | `story`, `story_part`, `session` | Stories: on the shelf; a title page and reading view; the voyage of sessions |
| art or music | `media`, with `role` and `stage` | Studio: on the light table by stage; portraits on people's pages |
| a contradiction or a gap | `open_question` with `relatedIds` | Workshop → Unresolved lore, and in each entry's GM ledger |

**Timeline order** uses `chronology.sortKey`:
- B.U. years as written (2012 … 2102).
- Then counting on: the Veil from 2103, Verdancy from about 2800, the Tide from about 5800.

**Images.** GPT Actions can't upload files, so a `media` record points at a `url`. That is either an `https://` address, or a path to an image shipped with the site (`/lore/peoples/teruanga.webp`). Portraits from documents are extracted by `scripts/build-lore-docs.py`.

## Audiences and the world's name

- **Who sees what.** Each record's `visibility` decides who sees it once tiered viewing is on (`TIDE_PUBLIC_SCOPE=tiered`):
  - `gm_only` is for the GM alone.
  - `player_safe` adds signed-in players (project members with role `player`).
  - `public` adds everyone.
  - Until tiered viewing is on, the project's open preview shows visitors everything published, read-only, as before.
- **The world's name.** The world is **Ilyr** (ih-LEER, /ɪˈliːr/), from the Teruānga for "light that remains"; the adjective is **Ilyrian**. Write it that way. Any leftover "Primus"/"Primal" (the old working name) is shown as Ilyr/Ilyrian automatically.

## Rebuilding the seed from the Word documents

```sh
python3 scripts/build-lore-docs.py <folder of .docx>   # → lore/docs/*.md and portraits
npx tsx scripts/build-lore-bundle.ts                    # → fixtures/publication/lore-release.json
```

- **Demo mode** publishes that release on top of the seed.
- **On the live site**, rebuild against the active release, then paste the file into **Workshop → Publishing**:
  ```sh
  npx tsx scripts/build-lore-bundle.ts --base <active release id>
  ```
