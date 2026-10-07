# App-owned API (`/api/v1`)

These endpoints belong to this application. They are not Space Pages or ChatGPT APIs.

## Authentication and protection

| Caller | How it authenticates | Where it is allowed |
| --- | --- | --- |
| GM in the browser | Supabase session cookie (verified server-side with `auth.getUser()`), plus membership `project_members.role = 'gm'` | All endpoints |
| Local demo | Fixed demo identity, **only** when `TIDE_DATA_MODE=demo` resolves (never on Vercel or in an unflagged production build) | All endpoints |
| Machine publisher | `Authorization: Bearer <token>` checked in constant time against `TIDE_PUBLISHER_TOKEN_SHA256`; in Supabase mode it also needs `SUPABASE_SECRET_KEY` | `validate` and `publish` only |

Rules applied to every endpoint:

- **No mutation via GET.** Mutations use POST, PATCH or DELETE; other methods return 405.
- **Cookie-authenticated mutations require same-origin.** The `Origin` header must match the app's origin (or `TIDE_ALLOWED_ORIGINS`); `Sec-Fetch-Site`, when present, must be `same-origin`. Requests with a bearer token skip the cookie path entirely.
- Bodies must be `Content-Type: application/json`. Size limits are 64 KB for live endpoints and 2 MB for bundles.
- Every input is validated on the server with strict schemas, even when a form already validated it.
- Responses carry `Cache-Control: private, no-store`.
- Errors never include stack traces or echo unknown server errors.

## Error envelope

```json
{ "error": { "code": "REVISION_CONFLICT", "message": "Human-readable text", "details": { } } }
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | No valid session, or a missing/invalid publisher token |
| `FORBIDDEN` | 403 | Signed in but not a GM of this project; bearer used on a non-publication endpoint; demo-only action in connected mode |
| `CSRF_REJECTED` | 403 | Missing or foreign `Origin`, or cross-site fetch metadata |
| `NOT_FOUND` | 404 | Unknown record, release or asset |
| `INVALID_JSON` | 400 | Body is not JSON |
| `INVALID_INPUT` | 400 | Field validation failed. `details.fieldErrors` maps `field` to a message |
| `FIELD_NOT_ALLOWED` | 400 | Unknown or source-owned field sent to a live endpoint. `details.fields` lists them |
| `PAYLOAD_TOO_LARGE` | 413 | Body over the limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Not `application/json` |
| `VALIDATION_FAILED` | 422 | Bundle failed validation. `details.issues` lists them |
| `UNSUPPORTED_SCHEMA_VERSION` | 422 | Unknown `schemaVersion` |
| `CROSS_PROJECT` | 422 | Bundle or asset belongs to another project |
| `STALE_BASE` | 409 | Active release changed. `details.activeReleaseId` gives the current one |
| `RELEASE_ID_CONFLICT` | 409 | Release ID already used with different content |
| `REVISION_CONFLICT` | 409 | A live record changed since you loaded it. `details.current` holds the latest copy |
| `SETUP_REQUIRED` | 503 | App not configured, or a feature unavailable in this mode (e.g. private assets in demo) |
| `INTERNAL` | 500 | Unexpected error (details are logged server-side without payloads) |

## Publication endpoints

### `POST /api/v1/publications/validate`
Body: a bundle (raw JSON). Never writes data. Auth: GM or machine publisher.
`200 { "preview": Preview }`, where Preview is `{ ok, releaseId, baseReleaseId, activeReleaseId, bundleHash, counts, changes[], relationshipChanges[], sourceGaps[], issues[] }`. Validation problems are reported inside `preview.issues` with `ok: false`; a 4xx is returned only for transport problems (auth, JSON, size).

### `POST /api/v1/publications/publish`
Body: a bundle. Auth: GM or machine publisher.
- `201 { status: "applied", release, preview }`: new active release.
- `200 { status: "replayed", release }`: identical retry; returns the original release.
- `409 STALE_BASE`, `409 RELEASE_ID_CONFLICT`, `422 VALIDATION_FAILED | CROSS_PROJECT | UNSUPPORTED_SCHEMA_VERSION`.

`release` = `{ id, projectId, version, kind, baseReleaseId, rollbackOfReleaseId, bundleHash, schemaVersion, createdAt, publishedAt, publishedBy, title, notes, counts }`.

### `POST /api/v1/publications/rollback`
Body: `{ "releaseId": "<new uuid>", "targetReleaseId": "<uuid>", "expectedActiveReleaseId": "<uuid>|null" }`. GM only (bearer refused).
Creates a new release that restores the target's published content. Idempotent per `releaseId`. Returns 201/200 like publish; 409 `STALE_BASE` if the active release moved; 404 if the target is unknown.

### `GET /api/v1/publications/releases`
GM only. `200 { activeReleaseId, releases[], events[] }` (release history and the last 50 audit events).

## Live (operational) endpoints

GM only. These never touch published lore, and every update needs `expectedRevision`.

| Method & path | Body | Notes |
| --- | --- | --- |
| `PATCH /api/v1/sessions/:sessionId/state` | `{ expectedRevision, status?, scheduledFor?, actualRunDate? }` | `expectedRevision: 0` creates the state row. Dates `YYYY-MM-DD` or null. Source-owned fields (`title`, `prep`, `recap`, …) → `FIELD_NOT_ALLOWED` |
| `POST /api/v1/checklist-items` | `{ subjectId, label }` | Subject must be a session or story |
| `PATCH /api/v1/checklist-items/:id` | `{ expectedRevision, label?, done?, sortOrder? }` | |
| `DELETE /api/v1/checklist-items/:id` | `{ expectedRevision }` | |
| `POST /api/v1/gm-notes` | `{ subjectId, body }` | Append-only; returns only `{ note: { id, createdAt } }` |
| `POST /api/v1/print-jobs` | print job fields (see below) | |
| `PATCH /api/v1/print-jobs/:id` | `{ expectedRevision, …fields }` | |
| `POST /api/v1/print-jobs/:id/attempts` | `{ expectedRevision, outcome: "succeeded"\|"failed", quantity, note? }` | Retries and reprints; never changes `requestedQuantity` |
| `POST /api/v1/builds` | `{ title, category, purpose?, status?, links?, notes?, linkedRecordIds? }` | |
| `PATCH /api/v1/builds/:id` | `{ expectedRevision, …fields }` | |
| `POST /api/v1/builds/:id/versions` | `{ expectedRevision, label, note?, url? }` | |
| `POST /api/v1/demo/reset` | `{}` | Demo mode only |

Print job fields: `title`, `sourceUrl?`, `fileReference?`, `fileFormat?`, `printerProfile?`, `material?`, `scale?`, `dimensions? {x,y,z,unit: mm|cm|in}`, `estimatedMinutes?`, `actualMinutes?`, `requestedQuantity` (1–10000), `completedQuantity?` (≤ requested), `status?` (planned, ready, printing, post_processing, complete, blocked, canceled), `priority?` (low, normal, high, urgent), `notes?`, `linkedRecordIds?`. A status of `complete` requires completed = requested.

## Assets

`GET /api/v1/assets/:mediaId`: checks the session and GM membership, then the media record's private asset reference, then answers `302` to a **60-second** Supabase signed URL (storage RLS re-checks membership). Signed URLs are never stored or cached. In demo mode it returns `503 SETUP_REQUIRED`.

## Auth routes

- `GET /auth/callback`: exchanges the Supabase magic-link code for a session cookie.
- `POST /auth/signout`: same-origin form post only.

## Example (machine publisher)

```bash
curl -sS -X POST "$APP/api/v1/publications/validate" \
  -H "Authorization: Bearer $TIDE_PUBLISHER_TOKEN" -H "Content-Type: application/json" \
  --data-binary @bundle.json
```
