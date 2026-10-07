# Publication contract: `tide.publication.v1`

A **publication bundle** is a JSON document that describes an explicit change to the published lore. Bundles are the only way authored content reaches the dashboard. The same validation runs in the demo importer, the GM publishing screen and the machine-publisher endpoint.

- TypeScript types and runtime validation: `src/lib/contract/schema.ts` (Zod, single source of truth)
- Generated JSON Schema: `contract/tide.publication.v1.schema.json` (`npm run contract:schema`; a test fails if it drifts)
- Semantic validation, preview, publish and rollback: `src/lib/domain/publication.ts`
- Fixtures: `fixtures/publication/seed-release.json`, `example-minimal.json`, `invalid/*.json`

> These are **our application's** formats and endpoints. They make no claim about Space Pages or ChatGPT capabilities. There is no Pages API client, webhook or sync.

## Bundle shape

```jsonc
{
  "schemaVersion": "tide.publication.v1",
  "projectId": "<uuid>",                // must equal the dashboard's project
  "releaseId": "<uuid>",                // new, unique per bundle; also the idempotency key
  "baseReleaseId": "<uuid>" | null,     // the active release you prepared against (null only for the first)
  "createdAt": "2026-10-07T12:00:00Z",  // supplied by the author; the server assigns publishedAt + version
  "title": "Short release note" | null,
  "notes": "Longer notes" | null,
  "bundleHash": "sha256:<hex>",         // OPTIONAL; if present must equal the server's canonical hash
  "operations": [ /* 1..2000 operations */ ]
}
```

### Operations

Every operation names a **stable target ID**. Each ID may appear in at most one operation per bundle. **Leaving a record out of a bundle never deletes it.** There is no "replace everything" mode.

| op | Fields | Effect |
| --- | --- | --- |
| `upsert` | `record` | Creates the identity if new, otherwise replaces its content. Lifecycle is unchanged (an archived record stays archived). |
| `archive` | `targetId`, `reason?` | Normal removal. The record stays readable, marked archived; live links keep working. |
| `restore` | `targetId`, `reason?` | Re-activates an archived record. |
| `tombstone` | `targetId`, `confirmTargetId` (must equal `targetId`), `reason` | Rare, explicit deletion. Content leaves the active release, the identity is retired forever (it can never be upserted again), and the last title and reason are kept so history and live references still resolve. It is refused while any other non-tombstoned record (active or archived) still references the target. |

### Record types

All records have `id` (lowercase UUID), `type`, `demo` (boolean, required) and `visibility` (`gm_only` by default, or `player_safe`, which only marks a record as eligible for a future player view and never publishes it). Titled records also have `slug?` (display only), `title`, `summary?`, `body?` (Markdown), `tags?`, `canonStatus` (`confirmed` | `provisional` | `unverified` | `non_canon`), `sourceRefs?` and `conflicts?`.

| `type` | Extra fields |
| --- | --- |
| `entity` | `kind` (environment, place, history, event, technology, relic, phenomenon, world_mechanic, concept, people, character, creature, faction, institution, other), `parentId?`, `aliases?`, `chronology?` `{label, certainty: unknown/uncertain/approximate/confirmed, sortKey?, notes}`, `mediaIds?` |
| `story` | `format` (campaign, one_shot, novel, short_fiction), `continuity` (shared_canon, story_specific, unknown), `draftStatus?`, `viewpointIds?`, `relatedIds?` |
| `story_part` | `storyId`, `partType` (outline, chapter, scene, other), `sequence?`, `draftStatus?`, `continuity`, `viewpointIds?`, `relatedIds?` |
| `session` | `storyId` (a campaign or one-shot), `sequence?`, `prep?` (Markdown), `recap?` (Markdown), `relatedIds?` |
| `relationship` | `fromId`, `toId`, `label`, `inverseLabel?`, `note?`, `canonStatus`, `sourceRefs?`. Shown in both directions. |
| `media` | `mediaType` (music, artwork, artistic_element, aesthetic, branding, design, document, other), `stage` (inspiration, draft, approved, final), `url?` and/or `asset?` `{bucket, path}` with the path starting `<projectId>/`, `attribution?`, `linkedIds?` |
| `source` | `title` (null if not supplied), `url?`, `documentId?`, `revision?`, `contentHash?`, `access` (public, private, restricted, unknown), `notes?` |
| `open_question` | `status` (open, resolved), `relatedIds?` |

Section placement is derived from `kind` / `format` / `mediaType` (`src/lib/domain/sections.ts`); the contract has no UI fields.

### Source references and honesty about unknowns

`sourceRefs: [{ sourceId, locator?, note? }]` points at `source` records. Fill `locator`, `revision` and `contentHash` **only when genuinely known**; otherwise use `null` or leave them out. `contentHash` is the hash of the source document and is unrelated to the bundle hash. The preview lists **source gaps** (non-demo records without references, and sources missing metadata) as warnings; they do not block publishing.

`conflicts: [{ description, sourceIds?, status }]` records unresolved source disagreements without resolving them.

## Validation rules (all enforced server-side)

1. Body size ≤ 2 MB, ≤ 2000 operations, plus per-field length limits (`LIMITS` in `schema.ts`).
2. Unsupported `schemaVersion` → `UNSUPPORTED_SCHEMA_VERSION`.
3. Strict structure: unknown fields, invalid enums, malformed IDs or ops → `SCHEMA_INVALID`.
4. `projectId` ≠ dashboard project, or an asset path outside the project → `CROSS_PROJECT`.
5. The same ID twice, or a record ID equal to the release ID → `DUPLICATE_ID`.
6. URLs must be absolute `https:`/`http:` with no embedded credentials (`http:` gives a warning) → `UNSAFE_URL`.
7. Markdown must not contain script/iframe/style/form/svg elements, `on…=` attributes, or `javascript:`/`data:`-style links → `UNSAFE_CONTENT`. Other raw HTML produces a warning and is not rendered.
8. Every reference must resolve, in the resulting state, to a non-tombstoned record of an allowed type → `INVALID_REFERENCE`. A reference to an archived record is a warning.
9. An existing ID cannot change type → `TYPE_MISMATCH`. Tombstoned IDs cannot be reused → `IDENTITY_RETIRED`.
10. `baseReleaseId` must equal the active release → `STALE_BASE` (409 at publish time).
11. A `releaseId` already used with the same hash is an idempotent replay (`ALREADY_APPLIED` in preview, `replayed` on publish). With a different hash → `RELEASE_ID_CONFLICT`.
12. Demo records must use `canonStatus: "non_canon"`.

## Canonical representation and bundle hash

`bundleHash = "sha256:" + hex(SHA-256(UTF-8(canonical(normalizedBundle without "bundleHash"))))`

- *normalizedBundle* is the bundle after schema parsing: defaults applied (e.g. `visibility: "gm_only"`, `continuity: "unknown"`) and `trim()`-ed required text.
- *canonical* is a JCS-style subset of RFC 8785: object keys sorted by UTF-16 code units, `undefined` properties omitted, `null` kept, array order preserved, strings via `JSON.stringify` with no Unicode normalization, finite numbers only, no whitespace.

You do **not** need to supply `bundleHash`; the server always computes and records it. To check one locally: `npm run contract:hash -- bundle.json` (structural check plus hash).

## Release flow

1. **Parse & validate** the whole bundle (rules above).
2. **Preview** against the active release: counts, record changes with changed field names, relationship changes, warnings, source gaps. **Nothing is written.**
3. **Explicit publish**: a GM clicks *Publish release* and confirms, or the authenticated machine publisher calls the endpoint. Both use the same `PublicationService.publish`.
4. **Atomic apply**: the service materializes the full next snapshot; the store commits it in one transaction (Supabase: `tide_commit_release` under a row lock) and switches the active release only on success. Readers always read through `projects.active_release_id`, so they never see half a release.
5. **Idempotency**: same `releaseId` + same hash returns the original release; a different hash is rejected; a stale base is a 409 conflict.
6. **Audit**: every applied, replayed and rejected attempt is recorded with its outcome, code, actor and counts. No content, tokens or URLs are logged.
7. **Rollback** creates a *new* release (higher version, `kind: "rollback"`) whose content equals an earlier snapshot. Records created after the target are archived (not deleted), tombstones stay tombstoned, and live records are never touched.

## Authoring guide (for the later ChatGPT-managed publisher)

Producing a bundle does not require knowing the UI.

1. **Ask the GM for the current active release ID** (shown in The Workshop → Publishing, or `GET /api/v1/publications/releases`) and use it as `baseReleaseId`.
2. **Generate a fresh lowercase UUID** for `releaseId`. Re-sending the identical bundle is safe.
3. **Reuse existing record IDs** for anything already published, whether you are changing its title, text or links. Keep a mapping from Page/section to record ID; never derive IDs from titles. New things get new UUIDs.
4. **Include only what changed.** Omitted records are left alone. To remove something use `archive`; use `tombstone` only when the GM explicitly asks to delete, and repeat the ID in `confirmTargetId`.
5. **Do not invent.** Unknown fields are `null` or omitted. Mark uncertain facts `canonStatus: "provisional"` or `"unverified"` and record disagreements in `conflicts`. Set `demo: false` for real content.
6. **Cite sources** with `sourceRefs` to `source` records. Fill `locator`/`revision`/`contentHash` only when genuinely available.
7. **Markdown only** in `body`/`prep`/`recap`; no HTML, scripts or non-http(s) links.
8. Hand the bundle to the GM to **preview and publish**, or (if configured) send it to the validate endpoint, show the GM the preview, and publish only after approval.

### Minimal realistic example

`fixtures/publication/example-minimal.json` (abridged): renames a demo record (same ID), adds one, archives one.

```json
{
  "schemaVersion": "tide.publication.v1",
  "projectId": "333ea628-f6a1-4f3a-8b83-ce98d12f2565",
  "releaseId": "<new uuid>",
  "baseReleaseId": "<active release id>",
  "createdAt": "2026-10-07T12:00:00Z",
  "title": "Example: rename, add and archive (demo records only)",
  "operations": [
    { "op": "upsert", "record": { "type": "entity", "id": "<existing id>", "kind": "faction", "title": "Demo faction (renamed)", "summary": "Demonstration faction.", "canonStatus": "non_canon", "demo": true } },
    { "op": "upsert", "record": { "type": "entity", "id": "<new uuid>", "kind": "relic", "title": "Demo relic", "canonStatus": "non_canon", "demo": true } },
    { "op": "archive", "targetId": "<existing id>", "reason": "Example archive; identity is preserved." }
  ]
}
```

Note that `upsert` **replaces** the whole record. Send every field you want to keep, not just the changed ones.

## Connecting the later publisher

The app-owned endpoints are `POST /api/v1/publications/validate` and `POST /api/v1/publications/publish` ([API.md](API.md)). For machine access:

1. Generate a long random token (≥ 32 chars) and keep it in the publisher's secret store.
2. Set `TIDE_PUBLISHER_TOKEN_SHA256` (hex SHA-256 of the token) and, in Supabase mode, `SUPABASE_SECRET_KEY` on the server only.
3. The publisher sends `Authorization: Bearer <token>` and `Content-Type: application/json`.
4. Recommended flow: validate → show the preview to the GM → publish only on approval.

The token check lives in `src/lib/server/publisher-auth.ts` and can be swapped for signed requests or OAuth without touching the publication service. The machine publisher can validate and publish, but cannot roll back or write live records.
