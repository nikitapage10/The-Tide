/**
 * The OpenAPI document for the machine publisher: what a ChatGPT custom GPT
 * imports as its Action. Kept lean (GPT Actions handle small schemas best);
 * the bundle body is described in prose and validated by the server, which
 * reports every problem in the preview.
 */
export function publisherOpenApi(origin: string) {
  const bundleRef = { $ref: "#/components/schemas/Bundle" };
  const preview = { description: "Validation preview: { preview: { ok, issues[], changes[], counts, sourceGaps[] } }" };
  return {
    openapi: "3.1.0",
    info: {
      title: "The Tide publisher",
      version: "1.0.0",
      description:
        "Publish lore to The Tide. Flow: getActiveRelease → listRecords (reuse existing IDs) → validateBundle (fix every issue) → publishBundle. Bundles follow tide.publication.v1 (see /contract/tide.publication.v1.schema.json and docs/PUBLICATION_CONTRACT.md). The publisher cannot tombstone; archive instead.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1/publications/active": {
        get: {
          operationId: "getActiveRelease",
          summary: "The active release ID (use it as the bundle's baseReleaseId) and the project ID.",
          responses: { "200": { description: "{ projectId, activeReleaseId, version }" } },
        },
      },
      "/api/v1/records/index": {
        get: {
          operationId: "listRecords",
          summary: "Every published record's ID, type, kind, title, slug and aliases (no bodies). Reuse these IDs to update.",
          responses: { "200": { description: "{ projectId, activeReleaseId, records[] }" } },
        },
      },
      "/api/v1/publications/validate": {
        post: {
          operationId: "validateBundle",
          summary: "Check a bundle without publishing. Always call this first and fix every issue.",
          requestBody: { required: true, content: { "application/json": { schema: bundleRef } } },
          responses: { "200": preview },
        },
      },
      "/api/v1/publications/publish": {
        post: {
          operationId: "publishBundle",
          summary: "Publish a validated bundle. Idempotent per releaseId. The GM can roll it back from the Workshop.",
          requestBody: { required: true, content: { "application/json": { schema: bundleRef } } },
          responses: { "201": { description: "Applied: { status, release, preview }" }, "200": { description: "Already applied, or refused with a preview" } },
        },
      },
    },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: {
        Bundle: {
          type: "object",
          required: ["schemaVersion", "projectId", "releaseId", "baseReleaseId", "createdAt", "operations"],
          properties: {
            schemaVersion: { type: "string", enum: ["tide.publication.v1"] },
            projectId: { type: "string", description: "From getActiveRelease." },
            releaseId: { type: "string", description: "A new random lowercase UUID for every bundle." },
            baseReleaseId: { type: ["string", "null"], description: "activeReleaseId from getActiveRelease." },
            createdAt: { type: "string", description: "ISO 8601 with offset, e.g. 2026-10-08T12:00:00Z." },
            title: { type: ["string", "null"], description: "A short release note." },
            notes: { type: ["string", "null"] },
            operations: {
              type: "array",
              description:
                "1..2000 of { op: 'upsert', record } | { op: 'archive', targetId, reason } | { op: 'restore', targetId, reason }. Records: entity, story, story_part, session, relationship, media, source, open_question.",
              items: { type: "object" },
            },
          },
        },
      },
    },
    security: [{ bearer: [] }],
  };
}
