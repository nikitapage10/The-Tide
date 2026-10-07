/**
 * Publication service: parse → validate → preview → publish / rollback.
 *
 * Used unchanged by the demo importer, the GM publishing UI and the future
 * machine publisher. Preview never writes. Publish writes only through
 * PublicationStore.commitRelease, which is atomic.
 */
import { canonicalJson, computeBundleHash, computeRecordHash, sha256Hex } from "@/lib/contract/canonical";
import { checkExternalUrl, checkMarkdown } from "@/lib/contract/safety";
import {
  LIMITS,
  SUPPORTED_SCHEMA_VERSIONS,
  UUID_PATTERN,
  zBundle,
  type Bundle,
  type PublishedRecord,
  type RecordType,
} from "@/lib/contract/schema";
import { DomainError } from "./errors";
import type { NewRelease, PublicationStore } from "./ports";
import type { Actor, PublishedState, RecordState, ReleaseCounts, ReleaseInfo } from "./types";

export type IssueSeverity = "error" | "warning" | "info";
export interface Issue {
  severity: IssueSeverity;
  code: string;
  message: string;
  path?: string;
  targetId?: string;
}

export type ChangeKind = "added" | "changed" | "unchanged" | "archived" | "restored" | "tombstoned";
export interface ChangeEntry {
  id: string;
  type: RecordType;
  title: string;
  change: ChangeKind;
  changedFields: string[];
}

export interface SourceGap {
  id: string;
  title: string;
  reason: string;
}

export interface Preview {
  ok: boolean;
  releaseId: string | null;
  baseReleaseId: string | null;
  activeReleaseId: string | null;
  bundleHash: string | null;
  counts: ReleaseCounts;
  changes: ChangeEntry[];
  relationshipChanges: ChangeEntry[];
  sourceGaps: SourceGap[];
  issues: Issue[];
}

// ----------------------------------------------------------------- parsing

export type ParseResult = { ok: true; bundle: Bundle; hash: string } | { ok: false; issues: Issue[]; code: "VALIDATION_FAILED" | "UNSUPPORTED_SCHEMA_VERSION" | "PAYLOAD_TOO_LARGE" | "INVALID_JSON" };

/** Parses raw JSON text with size limits. */
export function parseBundleText(text: string): ParseResult {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > LIMITS.maxBundleBytes) {
    return { ok: false, code: "PAYLOAD_TOO_LARGE", issues: [issue("error", "PAYLOAD_TOO_LARGE", `Bundle is ${bytes} bytes; the limit is ${LIMITS.maxBundleBytes}.`)] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, code: "INVALID_JSON", issues: [issue("error", "INVALID_JSON", `Not valid JSON: ${(e as Error).message}`)] };
  }
  return parseBundle(raw);
}

export function parseBundle(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "VALIDATION_FAILED", issues: [issue("error", "SCHEMA_INVALID", "Bundle must be a JSON object.")] };
  }
  const version = (raw as Record<string, unknown>).schemaVersion;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version as (typeof SUPPORTED_SCHEMA_VERSIONS)[number])) {
    return {
      ok: false,
      code: "UNSUPPORTED_SCHEMA_VERSION",
      issues: [issue("error", "UNSUPPORTED_SCHEMA_VERSION", `schemaVersion ${JSON.stringify(version ?? null)} is not supported. Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}.`, "schemaVersion")],
    };
  }
  const result = zBundle.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 200).map((i) =>
      issue("error", "SCHEMA_INVALID", i.message, formatPath(i.path), targetIdAt(raw, i.path)),
    );
    return { ok: false, code: "VALIDATION_FAILED", issues };
  }
  const bundle = result.data;
  const hash = computeBundleHash(bundle);
  if (bundle.bundleHash && bundle.bundleHash !== hash) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      issues: [issue("error", "HASH_MISMATCH", `bundleHash does not match the canonical hash (${hash}). Omit bundleHash or recompute it with npm run contract:hash.`, "bundleHash")],
    };
  }
  return { ok: true, bundle, hash };
}

// -------------------------------------------------------------- validation

/** Every outgoing reference of a record, with the record types it may point to. */
export function referencesOf(record: PublishedRecord): { path: string; id: string; allowed: RecordType[] | "titled" }[] {
  const refs: { path: string; id: string; allowed: RecordType[] | "titled" }[] = [];
  const add = (path: string, ids: readonly string[] | null | undefined, allowed: RecordType[] | "titled") =>
    (ids ?? []).forEach((id, i) => refs.push({ path: `${path}[${i}]`, id, allowed }));
  const one = (path: string, id: string | null | undefined, allowed: RecordType[] | "titled") => {
    if (id) refs.push({ path, id, allowed });
  };
  if ("sourceRefs" in record) record.sourceRefs?.forEach((s, i) => one(`sourceRefs[${i}].sourceId`, s.sourceId, ["source"]));
  if ("conflicts" in record) record.conflicts?.forEach((c, i) => add(`conflicts[${i}].sourceIds`, c.sourceIds, ["source"]));
  switch (record.type) {
    case "entity":
      one("parentId", record.parentId, ["entity"]);
      add("mediaIds", record.mediaIds, ["media"]);
      break;
    case "story":
      add("viewpointIds", record.viewpointIds, ["entity"]);
      add("relatedIds", record.relatedIds, "titled");
      break;
    case "story_part":
      one("storyId", record.storyId, ["story"]);
      add("viewpointIds", record.viewpointIds, ["entity"]);
      add("relatedIds", record.relatedIds, "titled");
      break;
    case "session":
      one("storyId", record.storyId, ["story"]);
      add("relatedIds", record.relatedIds, "titled");
      break;
    case "relationship":
      one("fromId", record.fromId, "titled");
      one("toId", record.toId, "titled");
      break;
    case "media":
      add("linkedIds", record.linkedIds, "titled");
      break;
    case "open_question":
      add("relatedIds", record.relatedIds, "titled");
      break;
    case "source":
      break;
  }
  return refs;
}

const TITLED: RecordType[] = ["entity", "story", "story_part", "session", "media", "open_question"];

export function recordTitle(record: PublishedRecord | null, fallback = "Untitled"): string {
  if (!record) return fallback;
  if (record.type === "relationship") return record.label;
  if (record.type === "source") return record.title ?? "Untitled source (title not supplied)";
  return record.title;
}

/** Materializes the bundle on top of `state`. Pure; returns the would-be snapshot and issues. */
export function applyBundle(bundle: Bundle, state: PublishedState, projectId: string): {
  records: Record<string, RecordState>;
  issues: Issue[];
  changes: ChangeEntry[];
} {
  const issues: Issue[] = [];
  const records: Record<string, RecordState> = { ...state.records };
  const changes: ChangeEntry[] = [];
  const releaseId = bundle.releaseId;

  if (bundle.projectId !== projectId) {
    issues.push(issue("error", "CROSS_PROJECT", `Bundle targets project ${bundle.projectId}, but this dashboard serves project ${projectId}.`, "projectId"));
  }
  if (bundle.baseReleaseId !== state.releaseId) {
    issues.push(
      issue(
        "error",
        "STALE_BASE",
        `Bundle was prepared against release ${bundle.baseReleaseId ?? "(none)"}, but the active release is ${state.releaseId ?? "(none)"}. Re-export against the active release.`,
        "baseReleaseId",
      ),
    );
  }
  if (state.records[bundle.releaseId]) {
    issues.push(issue("error", "DUPLICATE_ID", "releaseId collides with a record ID.", "releaseId"));
  }

  // Duplicate targets: each identity may appear in at most one operation.
  const seen = new Map<string, number>();
  bundle.operations.forEach((op, i) => {
    const id = op.op === "upsert" ? op.record.id : op.targetId;
    if (seen.has(id)) {
      issues.push(issue("error", "DUPLICATE_ID", `ID ${id} appears in operations[${seen.get(id)}] and operations[${i}]. Each record may appear once per bundle.`, `operations[${i}]`, id));
    } else seen.set(id, i);
    if (id === bundle.releaseId) issues.push(issue("error", "DUPLICATE_ID", "A record ID equals the releaseId.", `operations[${i}]`, id));
  });

  bundle.operations.forEach((op, i) => {
    const path = `operations[${i}]`;
    if (op.op === "upsert") {
      const rec = op.record;
      const prev = state.records[rec.id];
      checkRecordContent(rec, projectId, `${path}.record`, issues);
      if (prev?.lifecycle === "tombstoned") {
        issues.push(issue("error", "IDENTITY_RETIRED", `Record ${rec.id} was tombstoned and its identity is retired. Use a new ID.`, path, rec.id));
        return;
      }
      if (prev && prev.type !== rec.type) {
        issues.push(issue("error", "TYPE_MISMATCH", `Record ${rec.id} is a ${prev.type}; it cannot become a ${rec.type}.`, `${path}.record.type`, rec.id));
        return;
      }
      const hash = computeRecordHash(rec);
      if (!prev) {
        records[rec.id] = { id: rec.id, type: rec.type, lifecycle: "active", record: rec, tombstone: null, contentHash: hash, introducedIn: releaseId, changedIn: releaseId };
        changes.push(entry(rec, "added", []));
      } else if (prev.contentHash === hash) {
        changes.push(entry(rec, "unchanged", []));
      } else {
        records[rec.id] = { ...prev, record: rec, contentHash: hash, changedIn: releaseId };
        changes.push(entry(rec, "changed", diffFields(prev.record, rec)));
        if (prev.lifecycle === "archived") {
          issues.push(issue("warning", "ARCHIVED_UPSERT", `"${recordTitle(rec)}" is archived; its content was updated but it stays archived unless restored.`, path, rec.id));
        }
      }
      return;
    }
    const prev = state.records[op.targetId];
    if (!prev) {
      issues.push(issue("error", "INVALID_REFERENCE", `${op.op} target ${op.targetId} does not exist in the active release.`, `${path}.targetId`, op.targetId));
      return;
    }
    const title = prev.record ? recordTitle(prev.record) : (prev.tombstone?.lastTitle ?? op.targetId);
    if (prev.lifecycle === "tombstoned") {
      issues.push(issue("error", "IDENTITY_RETIRED", `${op.targetId} is tombstoned; it cannot be ${op.op}d.`, path, op.targetId));
      return;
    }
    if (op.op === "archive") {
      if (prev.lifecycle === "archived") {
        issues.push(issue("warning", "NO_OP", `"${title}" is already archived.`, path, op.targetId));
        return;
      }
      records[op.targetId] = { ...prev, lifecycle: "archived", changedIn: releaseId };
      changes.push({ id: prev.id, type: prev.type, title, change: "archived", changedFields: [] });
    } else if (op.op === "restore") {
      if (prev.lifecycle !== "archived") {
        issues.push(issue("error", "INVALID_OPERATION", `"${title}" is not archived, so it cannot be restored.`, path, op.targetId));
        return;
      }
      records[op.targetId] = { ...prev, lifecycle: "active", changedIn: releaseId };
      changes.push({ id: prev.id, type: prev.type, title, change: "restored", changedFields: [] });
    } else {
      if (op.confirmTargetId !== op.targetId) {
        issues.push(issue("error", "TOMBSTONE_NOT_CONFIRMED", "confirmTargetId must repeat targetId to confirm a tombstone.", `${path}.confirmTargetId`, op.targetId));
        return;
      }
      records[op.targetId] = {
        ...prev,
        lifecycle: "tombstoned",
        record: null,
        contentHash: null,
        tombstone: { lastTitle: title, reason: op.reason, releaseId },
        changedIn: releaseId,
      };
      changes.push({ id: prev.id, type: prev.type, title, change: "tombstoned", changedFields: [] });
    }
  });

  // Reference integrity against the resulting state (covers upserts and removals).
  for (const rs of Object.values(records)) {
    if (!rs.record || rs.lifecycle === "tombstoned") continue;
    const touched = rs.changedIn === releaseId;
    for (const ref of referencesOf(rs.record)) {
      const target = records[ref.id];
      const where = touched ? `record ${rs.id} ${ref.path}` : `existing record "${recordTitle(rs.record)}" ${ref.path}`;
      if (!target) {
        issues.push(issue("error", "INVALID_REFERENCE", `${where} points to unknown ID ${ref.id}.`, undefined, rs.id));
        continue;
      }
      if (target.lifecycle === "tombstoned") {
        issues.push(issue("error", "INVALID_REFERENCE", `${where} points to tombstoned record ${ref.id}. Remove the reference in the same bundle.`, undefined, rs.id));
        continue;
      }
      const allowed = ref.allowed === "titled" ? TITLED : ref.allowed;
      if (!allowed.includes(target.type)) {
        issues.push(issue("error", "INVALID_REFERENCE", `${where} must point to ${allowed.join("/")}, but ${ref.id} is a ${target.type}.`, undefined, rs.id));
        continue;
      }
      if (rs.record.type === "session" && ref.path === "storyId" && target.record?.type === "story" && !["campaign", "one_shot"].includes(target.record.format)) {
        issues.push(issue("error", "INVALID_REFERENCE", `Sessions belong to campaigns or one-shots; ${ref.id} is a ${target.record.format}.`, undefined, rs.id));
      }
      if (target.lifecycle === "archived" && rs.lifecycle === "active" && touched) {
        issues.push(issue("warning", "REFERENCES_ARCHIVED", `${where} points to archived record "${recordTitle(target.record)}".`, undefined, rs.id));
      }
    }
    if (rs.record.type === "relationship" && rs.record.fromId === rs.record.toId) {
      issues.push(issue("error", "INVALID_REFERENCE", `Relationship ${rs.id} links a record to itself.`, undefined, rs.id));
    }
  }

  return { records, issues, changes };
}

function checkRecordContent(rec: PublishedRecord, projectId: string, path: string, issues: Issue[]) {
  const urlFields: [string, string | null | undefined][] = [];
  const mdFields: [string, string | null | undefined][] = [];
  if (rec.type === "media") {
    urlFields.push(["url", rec.url], ["attribution.licenseUrl", rec.attribution?.licenseUrl]);
    if (!rec.url && !rec.asset) issues.push(issue("error", "INVALID_OPERATION", "Media needs a url or a private asset reference.", path, rec.id));
    if (rec.asset && !rec.asset.path.startsWith(`${projectId}/`)) {
      issues.push(issue("error", "CROSS_PROJECT", `Asset path must start with "${projectId}/".`, `${path}.asset.path`, rec.id));
    }
  }
  if (rec.type === "source") urlFields.push(["url", rec.url]);
  if ("body" in rec) mdFields.push(["body", rec.body]);
  if (rec.type === "session") mdFields.push(["prep", rec.prep], ["recap", rec.recap]);
  for (const [field, value] of urlFields) {
    if (!value) continue;
    const check = checkExternalUrl(value);
    if (!check.ok) issues.push(issue("error", "UNSAFE_URL", `${field}: ${check.reason}`, `${path}.${field}`, rec.id));
    else if (check.warning) issues.push(issue("warning", "INSECURE_URL", `${field}: ${check.warning}`, `${path}.${field}`, rec.id));
  }
  for (const [field, value] of mdFields) {
    if (!value) continue;
    for (const c of checkMarkdown(value)) {
      issues.push(issue(c.severity, c.severity === "error" ? "UNSAFE_CONTENT" : "RAW_HTML", `${field}: ${c.message}`, `${path}.${field}`, rec.id));
    }
  }
  if (rec.demo && rec.type !== "source" && rec.canonStatus !== "non_canon") {
    issues.push(issue("error", "INVALID_OPERATION", "Demo records must have canonStatus \"non_canon\".", `${path}.canonStatus`, rec.id));
  }
  if ("conflicts" in rec && rec.conflicts?.some((c) => c.status === "open")) {
    issues.push(issue("info", "OPEN_CONFLICT", `"${recordTitle(rec)}" carries an unresolved source conflict.`, path, rec.id));
  }
}

function sourceGapsFor(changes: ChangeEntry[], records: Record<string, RecordState>): SourceGap[] {
  const gaps: SourceGap[] = [];
  for (const c of changes) {
    if (c.change !== "added" && c.change !== "changed") continue;
    const rec = records[c.id]?.record;
    if (!rec || rec.demo) continue;
    if (rec.type === "source") {
      const missing = [!rec.title && "title", !rec.url && !rec.documentId && "url/documentId", !rec.revision && "revision", !rec.contentHash && "contentHash"].filter(Boolean);
      if (missing.length) gaps.push({ id: rec.id, title: recordTitle(rec), reason: `Source metadata not supplied: ${missing.join(", ")}.` });
    } else if (!("sourceRefs" in rec) || !rec.sourceRefs?.length) {
      gaps.push({ id: rec.id, title: recordTitle(rec), reason: "No source reference supplied." });
    }
  }
  return gaps;
}

export function countChanges(changes: ChangeEntry[], totalRecords: number): ReleaseCounts {
  const c: ReleaseCounts = { added: 0, changed: 0, unchanged: 0, archived: 0, restored: 0, tombstoned: 0, total: totalRecords };
  for (const ch of changes) c[ch.change] += 1;
  return c;
}

export function buildPreview(parsed: ParseResult, state: PublishedState, projectId: string): Preview & { records?: Record<string, RecordState> } {
  const empty = countChanges([], Object.keys(state.records).length);
  if (!parsed.ok) {
    return { ok: false, releaseId: null, baseReleaseId: null, activeReleaseId: state.releaseId, bundleHash: null, counts: empty, changes: [], relationshipChanges: [], sourceGaps: [], issues: parsed.issues };
  }
  const { bundle, hash } = parsed;
  const { records, issues, changes } = applyBundle(bundle, state, projectId);
  const ok = !issues.some((i) => i.severity === "error");
  return {
    ok,
    releaseId: bundle.releaseId,
    baseReleaseId: bundle.baseReleaseId,
    activeReleaseId: state.releaseId,
    bundleHash: hash,
    counts: countChanges(changes, Object.keys(records).length),
    changes: changes.filter((c) => c.type !== "relationship"),
    relationshipChanges: changes.filter((c) => c.type === "relationship"),
    sourceGaps: sourceGapsFor(changes, records),
    issues: sortIssues(issues),
    records,
  };
}

// ------------------------------------------------------------------ service

export interface PublishResult {
  status: "applied" | "replayed";
  release: ReleaseInfo;
  preview: Preview;
}

export class PublicationService {
  constructor(
    private readonly store: PublicationStore,
    private readonly projectId: string,
  ) {}

  /** Validation + diff. Never writes. */
  async preview(raw: unknown): Promise<Preview> {
    const parsed = typeof raw === "string" ? parseBundleText(raw) : parseBundle(raw);
    const state = await this.store.getActiveState();
    const { records: _r, ...preview } = buildPreview(parsed, state, this.projectId);
    void _r;
    // An exact retry of an already-applied release is reported, not treated as stale.
    if (parsed.ok) {
      const existing = await this.store.getRelease(parsed.bundle.releaseId);
      if (existing) {
        const same = existing.bundleHash === parsed.hash;
        return {
          ...preview,
          ok: false,
          issues: [
            issue(
              same ? "info" : "error",
              same ? "ALREADY_APPLIED" : "RELEASE_ID_CONFLICT",
              same
                ? `Release ${existing.id} was already published as version ${existing.version}; publishing again returns the original result.`
                : `Release ID ${existing.id} was already used with different content. Use a new releaseId.`,
              "releaseId",
            ),
          ],
        };
      }
    }
    return preview;
  }

  async publish(raw: unknown, actor: Actor): Promise<PublishResult> {
    const parsed = typeof raw === "string" ? parseBundleText(raw) : parseBundle(raw);
    if (!parsed.ok) {
      await this.audit(null, "rejected", parsed.code, actor, null);
      throw new DomainError(parsed.code, "The bundle failed validation.", { issues: parsed.issues });
    }
    const { bundle, hash } = parsed;

    // Idempotency first: an exact retry succeeds even though its base is now stale.
    const existing = await this.store.getRelease(bundle.releaseId);
    if (existing) return this.replayOrConflict(existing, hash, actor);

    const state = await this.store.getActiveState();
    const built = buildPreview(parsed, state, this.projectId);
    const { records, ...preview } = built;
    const errors = preview.issues.filter((i) => i.severity === "error");
    if (errors.length) {
      const code = errors.some((e) => e.code === "STALE_BASE")
        ? "STALE_BASE"
        : errors.some((e) => e.code === "CROSS_PROJECT")
          ? "CROSS_PROJECT"
          : "VALIDATION_FAILED";
      await this.audit(bundle.releaseId, "rejected", code, actor, null);
      throw new DomainError(code, code === "STALE_BASE" ? "The active release changed since this bundle was prepared." : "The bundle failed validation.", {
        issues: preview.issues,
        activeReleaseId: state.releaseId,
      });
    }

    const release: NewRelease = {
      id: bundle.releaseId,
      projectId: this.projectId,
      kind: "publish",
      baseReleaseId: bundle.baseReleaseId,
      rollbackOfReleaseId: null,
      bundleHash: hash,
      schemaVersion: bundle.schemaVersion,
      createdAt: bundle.createdAt,
      publishedBy: actor,
      title: bundle.title ?? null,
      notes: bundle.notes ?? null,
      counts: preview.counts,
    };
    const result = await this.store.commitRelease(release, Object.values(records!));
    return this.finish(result, preview, actor, hash);
  }

  /**
   * Rollback = a new release whose published content equals an earlier snapshot.
   * - Records created after the target are archived (identity kept for live references).
   * - Tombstoned identities stay tombstoned.
   * - Live/operational records are never touched.
   */
  async rollback(input: { releaseId: string; targetReleaseId: string; expectedActiveReleaseId: string | null; createdAt?: string }, actor: Actor): Promise<PublishResult> {
    if (!UUID_PATTERN.test(input.releaseId) || !UUID_PATTERN.test(input.targetReleaseId)) {
      throw new DomainError("INVALID_INPUT", "releaseId and targetReleaseId must be lowercase UUIDs.");
    }
    const hash = `sha256:${sha256Hex(
      canonicalJson({ kind: "rollback", projectId: this.projectId, targetReleaseId: input.targetReleaseId, baseReleaseId: input.expectedActiveReleaseId }),
    )}`;
    const existing = await this.store.getRelease(input.releaseId);
    if (existing) return this.replayOrConflict(existing, hash, actor);

    const target = await this.store.getRelease(input.targetReleaseId);
    const targetState = await this.store.getReleaseState(input.targetReleaseId);
    if (!target || !targetState || target.projectId !== this.projectId) {
      throw new DomainError("NOT_FOUND", "Target release not found in this project.");
    }
    const current = await this.store.getActiveState();
    if (current.releaseId !== input.expectedActiveReleaseId) {
      await this.audit(input.releaseId, "rejected", "STALE_BASE", actor, null);
      throw new DomainError("STALE_BASE", "The active release changed; reload before rolling back.", { activeReleaseId: current.releaseId });
    }
    if (current.releaseId === input.targetReleaseId) {
      throw new DomainError("INVALID_INPUT", "That release is already active.");
    }

    const records: Record<string, RecordState> = {};
    const changes: ChangeEntry[] = [];
    const ids = new Set([...Object.keys(current.records), ...Object.keys(targetState.records)]);
    for (const id of ids) {
      const now = current.records[id];
      const then = targetState.records[id];
      let next: RecordState;
      if (now?.lifecycle === "tombstoned") next = now;
      else if (!then) next = { ...now!, lifecycle: "archived" };
      else if (then.lifecycle === "tombstoned") next = then;
      else next = { ...then, introducedIn: now?.introducedIn ?? then.introducedIn };
      const changed = !now || now.lifecycle !== next.lifecycle || now.contentHash !== next.contentHash;
      if (changed) next = { ...next, changedIn: input.releaseId };
      records[id] = next;
      const title = next.record ? recordTitle(next.record) : (next.tombstone?.lastTitle ?? id);
      const change: ChangeKind = !changed
        ? "unchanged"
        : !now
          ? "added"
          : next.lifecycle === "archived" && now.lifecycle !== "archived"
            ? "archived"
            : next.lifecycle === "active" && now.lifecycle === "archived"
              ? "restored"
              : "changed";
      changes.push({ id, type: next.type, title, change, changedFields: change === "changed" ? diffFields(now?.record ?? null, next.record) : [] });
    }
    const counts = countChanges(changes, ids.size);
    const preview: Preview = {
      ok: true,
      releaseId: input.releaseId,
      baseReleaseId: input.expectedActiveReleaseId,
      activeReleaseId: current.releaseId,
      bundleHash: hash,
      counts,
      changes: changes.filter((c) => c.type !== "relationship" && c.change !== "unchanged"),
      relationshipChanges: changes.filter((c) => c.type === "relationship" && c.change !== "unchanged"),
      sourceGaps: [],
      issues: [],
    };
    const release: NewRelease = {
      id: input.releaseId,
      projectId: this.projectId,
      kind: "rollback",
      baseReleaseId: input.expectedActiveReleaseId,
      rollbackOfReleaseId: input.targetReleaseId,
      bundleHash: hash,
      schemaVersion: target.schemaVersion,
      createdAt: input.createdAt ?? new Date().toISOString(),
      publishedBy: actor,
      title: `Rollback to version ${target.version}`,
      notes: null,
      counts,
    };
    const result = await this.store.commitRelease(release, Object.values(records));
    return this.finish(result, preview, actor, hash);
  }

  private async replayOrConflict(existing: ReleaseInfo, hash: string, actor: Actor): Promise<PublishResult> {
    if (existing.bundleHash !== hash) {
      await this.audit(existing.id, "rejected", "RELEASE_ID_CONFLICT", actor, null);
      throw new DomainError("RELEASE_ID_CONFLICT", `Release ID ${existing.id} was already used with different content.`);
    }
    await this.audit(existing.id, "replayed", null, actor, existing.counts);
    return { status: "replayed", release: existing, preview: emptyPreview(existing) };
  }

  private async finish(result: Awaited<ReturnType<PublicationStore["commitRelease"]>>, preview: Preview, actor: Actor, hash: string): Promise<PublishResult> {
    if (result.status === "conflict") {
      await this.audit(preview.releaseId, "rejected", result.code, actor, null);
      throw new DomainError(result.code, result.code === "STALE_BASE" ? "The active release changed while publishing." : "Release ID already used with different content.", {
        activeReleaseId: result.activeReleaseId,
      });
    }
    if (result.status === "replayed" && result.release.bundleHash !== hash) {
      throw new DomainError("RELEASE_ID_CONFLICT", "Release ID already used with different content.");
    }
    await this.audit(result.release.id, result.status, null, actor, result.release.counts);
    return { status: result.status, release: result.release, preview };
  }

  private async audit(releaseId: string | null, outcome: "applied" | "replayed" | "rejected", code: string | null, actor: Actor, counts: ReleaseCounts | null) {
    try {
      await this.store.recordPublicationEvent({ releaseId, outcome, code, actor, counts });
    } catch {
      // Audit failure must not mask the primary result; adapters log server-side.
    }
  }
}

// ------------------------------------------------------------------ helpers

function emptyPreview(release: ReleaseInfo): Preview {
  return {
    ok: true,
    releaseId: release.id,
    baseReleaseId: release.baseReleaseId,
    activeReleaseId: null,
    bundleHash: release.bundleHash,
    counts: release.counts,
    changes: [],
    relationshipChanges: [],
    sourceGaps: [],
    issues: [],
  };
}

function entry(rec: PublishedRecord, change: ChangeKind, changedFields: string[]): ChangeEntry {
  return { id: rec.id, type: rec.type, title: recordTitle(rec), change, changedFields };
}

function diffFields(prev: PublishedRecord | null, next: PublishedRecord | null): string[] {
  const a = (prev ?? {}) as Record<string, unknown>;
  const b = (next ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => canonicalJson(a[k] ?? null) !== canonicalJson(b[k] ?? null)).sort();
}

function issue(severity: IssueSeverity, code: string, message: string, path?: string, targetId?: string): Issue {
  return { severity, code, message, ...(path ? { path } : {}), ...(targetId ? { targetId } : {}) };
}

function sortIssues(issues: Issue[]): Issue[] {
  const rank = { error: 0, warning: 1, info: 2 } as const;
  return [...issues].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("").replace(/^\./, "");
}

function targetIdAt(raw: unknown, path: readonly PropertyKey[]): string | undefined {
  if (path[0] !== "operations" || typeof path[1] !== "number") return undefined;
  const op = (raw as { operations?: unknown[] }).operations?.[path[1]] as Record<string, unknown> | undefined;
  const id = (op?.record as Record<string, unknown> | undefined)?.id ?? op?.targetId;
  return typeof id === "string" ? id : undefined;
}
