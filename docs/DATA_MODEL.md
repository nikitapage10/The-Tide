# Data model, ownership and identity

## Four separate concerns

| Concern | In code | In Postgres |
| --- | --- | --- |
| **Identity & membership** | `ProjectInfo`, `Actor`, record UUIDs | `projects`, `project_members`, `record_identities` |
| **Published, versioned lore** (immutable per release) | `ReleaseInfo`, `RecordState`, `PublishedState` | `releases`, `release_records` (full snapshot per release), `publication_events` |
| **Live operational records** | `SessionState`, `ChecklistItem`, `GmNote`, `PrintJob`, `PrintAttempt`, `BuildRecord`, `ActivityEvent` | `session_states`, `checklist_items`, `gm_notes`, `print_jobs`, `print_attempts`, `builds`, `activity_events` |
| **Sources & assets** | `source` and `media` records (published) plus signed URLs issued per request | `source`/`media` rows in `release_records`, plus the private `tide-private` storage bucket |

## Stable-ID rules

1. Every record, live item and release has an opaque lowercase UUID. Identity is never derived from a title, slug, order or array index.
2. Titles and slugs are ordinary content. Changing them changes content, never identity, and is covered by tests.
3. `record_identities` registers each published ID once, with its type and project. IDs cannot change type or project, cannot be deleted, and survive archive, tombstone and rollback.
4. Live records reference published records only through `record_identities` (FKs `(project_id, id)` with `ON DELETE RESTRICT`), never through a release-specific row. Nothing cascades.
5. Fixture IDs are fixed in `fixtures/ids.json` and the fixture JSON, so they are stable across runs.
6. A tombstoned ID is retired; a replacement needs a new UUID.

## Field-ownership map

**Source-owned** fields are written only by the publication service from a validated bundle. **Live-owned** fields are written only by the operations service from dashboard actions.

| Record | Source-owned (Space Pages → release) | Live-owned (dashboard) |
| --- | --- | --- |
| Entity / story / story part / media / source / open question | every field in the contract | none (GM notes attach separately by ID) |
| Session | `title`, `summary`, `body`, `prep`, `recap`, `storyId`, `sequence`, `relatedIds`, `tags`, `visibility`, `canonStatus`, `demo`, `sourceRefs`, `conflicts`, `slug` | `session_states`: `status`, `scheduledFor`, `actualRunDate` (+ `revision`) |
| Story (campaign / one-shot) | all contract fields | checklist items with `subjectId` = story |
| Checklist item | n/a | `subjectId`, `label`, `done`, `sortOrder` |
| GM note | n/a | `subjectId`, `body` (append-only) |
| Print job / attempt | n/a | all fields in `LIVE_OWNED_FIELDS.print_job` / `print_attempt` |
| Build | n/a | all fields incl. `versions` |
| Activity event | n/a | written by the operations service only |

How the boundary is enforced:

- **Code:** `SOURCE_OWNED_FIELDS` / `LIVE_OWNED_FIELDS` in `src/lib/domain/operations.ts`. Every live mutation uses a strict Zod schema: unknown keys give `FIELD_NOT_ALLOWED`, and source-owned names produce an explicit message. The operations service has no write access to the publication store. A unit test asserts the session live and source field sets are disjoint.
- **Schema:** operational tables have no columns for source-owned fields. Published tables have no INSERT/UPDATE/DELETE grants for API roles and are write-protected by triggers. The only writer is `tide_commit_release` (SECURITY DEFINER), which writes publication tables only.
- **Concurrency:** live rows carry `revision`. Updates use `WHERE revision = expected` and a trigger requires `revision = old + 1`. A mismatch becomes `REVISION_CONFLICT`, and the UI offers to reload.

## Lifecycle of a published record

`active` → `archived` (archive) → `active` (restore) → … → `tombstoned` (explicit, final).

- **Archived:** content stays in the snapshot and pages remain readable with an "Archived" badge. Live links resolve.
- **Tombstoned:** content is removed and `{lastTitle, reason, releaseId}` is kept. Pages show "Removed". Live links show the last title and a "Removed" state.
- **Unknown ID** (never published): live links show "Unavailable".

## Release and rollback design

- Each release stores a **full materialized snapshot** of every record state (`release_records`). This favours simplicity and exact rollback over storage efficiency, which is appropriate for one private project.
- The **active release** is a single pointer (`projects.active_release_id`) switched in the same transaction that inserts the snapshot. Readers always read one complete snapshot.
- **Versions** are server-assigned (`release_count + 1`) and only increase. Rollbacks are new versions (`kind: "rollback"`, `rollbackOfReleaseId`), so time never runs backwards.
- **Rollback semantics:** target content is restored; records introduced after the target are **archived** (their identities and live links persist); tombstoned identities stay tombstoned; operational tables are untouched.
- **Retry safety:** `releaseId` is the idempotency key, checked again inside the transaction together with the bundle hash and the base release (compare-and-swap).

## Adapters

`src/lib/domain/ports.ts` defines `PublicationStore` and `OperationalStore`. All rules (validation, diffing, materialization, ownership, quantities, activity) live in the shared services, so adapters only store and load:

| Adapter | File | Use |
| --- | --- | --- |
| `MemoryStore` | `src/lib/data/memory-store.ts` | Tests. Each write is applied to a cloned document and swapped in atomically; fault-injection hooks simulate failures. |
| Demo file store | `src/lib/data/demo-file-store.ts` | Local demo. `MemoryStore` persisted to `.tide-demo/state.json` with atomic file replace. **Not production storage.** |
| `SupabaseStore` | `src/lib/data/supabase-store.ts` | Connected mode. Per-request client with the GM's session (RLS) or, for the machine publisher only, the server secret key. Publishing goes through the `tide_commit_release` RPC; print attempts through `tide_record_print_attempt`. |

Request wiring is in `src/lib/server/context.ts`.

## What is "live"

Pages render on the server per request (`force-dynamic`) and refetch after each mutation (`router.refresh()`). There are **no Realtime subscriptions**. Changes made in another tab or device appear on the next navigation or refresh, and the revision check stops one tab from silently overwriting another.
