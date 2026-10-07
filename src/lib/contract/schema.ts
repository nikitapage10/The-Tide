/**
 * The Tide publication contract — schema version "tide.publication.v1".
 *
 * This is the single source of truth for the JSON bundles that move authored
 * lore from Space Pages (via a deliberate, assistant-managed publication step)
 * into the dashboard. The same schema is used by the demo importer, the
 * protected publishing endpoint and the future machine publisher.
 *
 * Human documentation: docs/PUBLICATION_CONTRACT.md
 * Generated JSON Schema: contract/tide.publication.v1.schema.json (npm run contract:schema)
 */
import { z } from "zod";

export const SCHEMA_VERSION = "tide.publication.v1" as const;
export const SUPPORTED_SCHEMA_VERSIONS = [SCHEMA_VERSION] as const;

/** Hard input limits. Requests above these are rejected before parsing. */
export const LIMITS = {
  maxBundleBytes: 2 * 1024 * 1024,
  maxOperations: 2000,
  maxTitle: 300,
  maxSummary: 4000,
  maxMarkdown: 100_000,
  maxTags: 50,
  maxTag: 60,
  maxUrl: 2048,
  maxIdList: 200,
  maxNote: 4000,
} as const;

/** Lowercase canonical UUID text. Identity is never derived from titles, slugs or order. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const zId = z
  .string()
  .regex(UUID_PATTERN, "must be a lowercase UUID such as 3f2b1c9e-8d4a-4e1f-9b6a-2c7d5e8f1a03");

const zText = (max: number) => z.string().trim().min(1).max(max);
const zNullableText = (max: number) => z.string().max(max).nullable().optional();
/** Markdown is stored as text and sanitized at render time; unsafe constructs are rejected by the validator. */
const zMarkdown = z.string().max(LIMITS.maxMarkdown).nullable().optional();
/** URLs are syntax-checked here; protocol/credential safety is enforced by the semantic validator. */
const zUrl = z.string().max(LIMITS.maxUrl);

export const VISIBILITIES = ["gm_only", "player_safe"] as const;
/**
 * "player_safe" only marks a record as a candidate for a future, server-side
 * player projection. It never makes anything public on its own.
 */
export const zVisibility = z.enum(VISIBILITIES);

export const CANON_STATUSES = ["confirmed", "provisional", "unverified", "non_canon"] as const;
export const zCanonStatus = z.enum(CANON_STATUSES);

export const zTags = z.array(z.string().trim().min(1).max(LIMITS.maxTag)).max(LIMITS.maxTags);

export const zSourceRef = z.strictObject({
  sourceId: zId,
  /** Page, section or heading inside the source, only when genuinely known. */
  locator: zNullableText(500),
  note: zNullableText(1000),
});

export const zConflict = z.strictObject({
  description: zText(LIMITS.maxNote),
  sourceIds: z.array(zId).max(20).optional(),
  status: z.enum(["open", "resolved"]).default("open"),
});

const zIdList = z.array(zId).max(LIMITS.maxIdList);

/** Fields shared by every titled record. */
const baseFields = {
  id: zId,
  /** Display-only, mutable. Never used as identity. */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase letters, digits and hyphens")
    .max(120)
    .nullable()
    .optional(),
  title: zText(LIMITS.maxTitle),
  summary: zNullableText(LIMITS.maxSummary),
  body: zMarkdown,
  tags: zTags.optional(),
  visibility: zVisibility.default("gm_only"),
  canonStatus: zCanonStatus,
  /** Machine-readable demonstration flag. Demo records are never canon. */
  demo: z.boolean(),
  sourceRefs: z.array(zSourceRef).max(50).optional(),
  conflicts: z.array(zConflict).max(20).optional(),
};

export const ENTITY_KINDS = [
  "people",
  "faction",
  "location",
  "creature",
  "event",
  "concept",
  "item",
  "other",
] as const;

export const CERTAINTIES = ["unknown", "uncertain", "approximate", "confirmed"] as const;

/** Chronology allows unknown dates and uncertainty; nothing is forced onto a timeline. */
export const zChronology = z.strictObject({
  /** Free-text placement exactly as the source states it, or null when not supplied. */
  label: zNullableText(300),
  certainty: z.enum(CERTAINTIES),
  /** Optional ordering hint, only when the source supports an order. */
  sortKey: z.number().finite().nullable().optional(),
  notes: zNullableText(LIMITS.maxNote),
});

export const zEntity = z.strictObject({
  ...baseFields,
  type: z.literal("entity"),
  kind: z.enum(ENTITY_KINDS),
  aliases: z.array(zText(200)).max(30).optional(),
  chronology: zChronology.nullable().optional(),
  mediaIds: zIdList.optional(),
});

export const CAMPAIGN_FORMATS = ["ongoing", "one_shot"] as const;
export const zCampaign = z.strictObject({
  ...baseFields,
  type: z.literal("campaign"),
  format: z.enum(CAMPAIGN_FORMATS),
  relatedIds: zIdList.optional(),
});

export const zSession = z.strictObject({
  ...baseFields,
  type: z.literal("session"),
  campaignId: zId,
  /** Display order within the campaign only. */
  sequence: z.number().int().min(0).max(100_000).nullable().optional(),
  /** Published preparation material (authored in Pages). */
  prep: zMarkdown,
  /** Published recap narrative (authored in Pages). */
  recap: zMarkdown,
  relatedIds: zIdList.optional(),
});

export const zRelationship = z.strictObject({
  id: zId,
  type: z.literal("relationship"),
  fromId: zId,
  toId: zId,
  /** Label read from the "from" record, e.g. "Located in". */
  label: zText(120),
  /** Label read from the "to" record. Null means the same label applies both ways. */
  inverseLabel: zNullableText(120),
  note: zNullableText(LIMITS.maxNote),
  visibility: zVisibility.default("gm_only"),
  canonStatus: zCanonStatus,
  demo: z.boolean(),
  sourceRefs: z.array(zSourceRef).max(50).optional(),
  conflicts: z.array(zConflict).max(20).optional(),
});

export const MEDIA_TYPES = ["music", "image", "video", "document", "map", "other"] as const;
export const zAssetRef = z.strictObject({
  /** Private storage bucket. Signed URLs are issued per request and never stored. */
  bucket: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  /** Object path; must start with the project ID (enforced by the validator). */
  path: z
    .string()
    .min(1)
    .max(1024)
    .refine((p) => !p.includes("..") && !p.startsWith("/"), "asset path must be relative without '..'"),
});

export const zMedia = z.strictObject({
  ...baseFields,
  type: z.literal("media"),
  mediaType: z.enum(MEDIA_TYPES),
  url: zUrl.nullable().optional(),
  asset: zAssetRef.nullable().optional(),
  attribution: z
    .strictObject({
      creator: zNullableText(300),
      license: zNullableText(300),
      licenseUrl: zUrl.nullable().optional(),
    })
    .nullable()
    .optional(),
  linkedIds: zIdList.optional(),
});

export const SOURCE_ACCESS = ["public", "private", "restricted", "unknown"] as const;
export const zSource = z.strictObject({
  id: zId,
  type: z.literal("source"),
  /** Null when the title has not been supplied. Never invent titles. */
  title: zNullableText(LIMITS.maxTitle),
  url: zUrl.nullable().optional(),
  /** External document identity (e.g. a Drive file ID) when genuinely known. */
  documentId: zNullableText(300),
  revision: zNullableText(200),
  /** Hash of the source document itself (not the bundle), e.g. "sha256:<hex>". */
  contentHash: z
    .string()
    .regex(/^[a-z0-9-]+:[A-Za-z0-9+/=_-]{8,256}$/, "contentHash must look like 'sha256:<hex>'")
    .nullable()
    .optional(),
  access: z.enum(SOURCE_ACCESS),
  notes: zNullableText(LIMITS.maxNote),
  visibility: zVisibility.default("gm_only"),
  demo: z.boolean(),
});

export const zOpenQuestion = z.strictObject({
  ...baseFields,
  type: z.literal("open_question"),
  status: z.enum(["open", "resolved"]),
  relatedIds: zIdList.optional(),
});

export const zPublishedRecord = z.discriminatedUnion("type", [
  zEntity,
  zCampaign,
  zSession,
  zRelationship,
  zMedia,
  zSource,
  zOpenQuestion,
]);

export const RECORD_TYPES = [
  "entity",
  "campaign",
  "session",
  "relationship",
  "media",
  "source",
  "open_question",
] as const;

export const zUpsertOp = z.strictObject({ op: z.literal("upsert"), record: zPublishedRecord });
export const zArchiveOp = z.strictObject({
  op: z.literal("archive"),
  targetId: zId,
  reason: zNullableText(1000),
});
export const zRestoreOp = z.strictObject({
  op: z.literal("restore"),
  targetId: zId,
  reason: zNullableText(1000),
});
/**
 * Tombstone = explicit, rare deletion. Identity is retired (kept for history and
 * live references) and content is removed from the active release.
 * `confirmTargetId` must repeat `targetId` to make intent explicit.
 */
export const zTombstoneOp = z.strictObject({
  op: z.literal("tombstone"),
  targetId: zId,
  confirmTargetId: zId,
  reason: zText(1000),
});

export const zOperation = z.discriminatedUnion("op", [zUpsertOp, zArchiveOp, zRestoreOp, zTombstoneOp]);

export const zBundle = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: zId,
  releaseId: zId,
  /** The release this bundle was prepared against; null only for the very first release. */
  baseReleaseId: zId.nullable(),
  /** Supplied by the author/publisher. The server assigns its own publication timestamp. */
  createdAt: z.iso.datetime({ offset: true }),
  title: zNullableText(200),
  notes: zNullableText(LIMITS.maxNote),
  /** Optional. If present it must equal the server-computed hash (see docs). */
  bundleHash: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .optional(),
  operations: z.array(zOperation).min(1).max(LIMITS.maxOperations),
});

export type Bundle = z.infer<typeof zBundle>;
export type BundleInput = z.input<typeof zBundle>;
export type Operation = z.infer<typeof zOperation>;
export type PublishedRecord = z.infer<typeof zPublishedRecord>;
export type RecordType = PublishedRecord["type"];
export type EntityRecord = z.infer<typeof zEntity>;
export type CampaignRecord = z.infer<typeof zCampaign>;
export type SessionRecord = z.infer<typeof zSession>;
export type RelationshipRecord = z.infer<typeof zRelationship>;
export type MediaRecord = z.infer<typeof zMedia>;
export type SourceRecord = z.infer<typeof zSource>;
export type OpenQuestionRecord = z.infer<typeof zOpenQuestion>;
export type EntityKind = (typeof ENTITY_KINDS)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type CanonStatus = (typeof CANON_STATUSES)[number];
export type SourceRef = z.infer<typeof zSourceRef>;
export type Chronology = z.infer<typeof zChronology>;
