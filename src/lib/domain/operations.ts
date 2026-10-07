/**
 * Operational (live-owned) service: session state, checklists, GM notes,
 * print jobs, Workshop builds and activity events.
 *
 * Boundary enforcement in code:
 *  - Every mutation input is a *strict* schema listing only live-owned fields.
 *    Unknown fields are rejected (FIELD_NOT_ALLOWED), and source-owned field
 *    names get an explicit explanation.
 *  - This service has no access to PublicationStore writes; it can only read
 *    the active published state to validate references.
 *  - Every update carries expectedRevision (optimistic concurrency).
 */
import { z } from "zod";
import { checkExternalUrl } from "@/lib/contract/safety";
import { zEntity, zMedia, zOpenQuestion, zSession, zStory, zStoryPart, zId } from "@/lib/contract/schema";
import { DomainError } from "./errors";
import type { CasResult, OperationalStore } from "./ports";
import { recordTitle } from "./publication";
import {
  BUILD_CATEGORIES,
  BUILD_STATUSES,
  LENGTH_UNITS,
  PRINT_PRIORITIES,
  PRINT_STATUSES,
  SESSION_STATUSES,
  type Actor,
  type ActivityEvent,
  type BuildRecord,
  type ChecklistItem,
  type GmNote,
  type PrintAttempt,
  type PrintJob,
  type PublishedState,
  type SessionState,
} from "./types";

// ------------------------------------------------------------ ownership map

/** Fields owned by Space Pages via publication. The dashboard can never write these. */
export const SOURCE_OWNED_FIELDS: Record<string, readonly string[]> = {
  entity: Object.keys(zEntity.shape),
  story: Object.keys(zStory.shape),
  story_part: Object.keys(zStoryPart.shape),
  session: Object.keys(zSession.shape),
  media: Object.keys(zMedia.shape),
  open_question: Object.keys(zOpenQuestion.shape),
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "not a real calendar date");
const revision = z.number().int().min(0);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const optMinutes = z.number().int().min(0).max(100_000).nullable().optional();
const dimension = z.number().positive().max(100_000).nullable();

export const zSessionStatePatch = z.strictObject({
  expectedRevision: revision,
  status: z.enum(SESSION_STATUSES).optional(),
  scheduledFor: isoDate.nullable().optional(),
  actualRunDate: isoDate.nullable().optional(),
});
export const zChecklistCreate = z.strictObject({ subjectId: zId, label: z.string().trim().min(1, "Enter a label").max(300) });
export const zChecklistUpdate = z.strictObject({
  expectedRevision: revision,
  label: z.string().trim().min(1, "Enter a label").max(300).optional(),
  done: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
});
export const zChecklistDelete = z.strictObject({ expectedRevision: revision });
export const zGmNoteCreate = z.strictObject({ subjectId: zId, body: z.string().trim().min(1, "Write a note").max(10_000) });

const printFields = {
  title: z.string().trim().min(1, "Enter a title").max(200),
  sourceUrl: optText(2048),
  fileReference: optText(500),
  fileFormat: optText(40),
  printerProfile: optText(200),
  material: optText(200),
  scale: optText(60),
  dimensions: z.strictObject({ x: dimension, y: dimension, z: dimension, unit: z.enum(LENGTH_UNITS) }).nullable().optional(),
  estimatedMinutes: optMinutes,
  actualMinutes: optMinutes,
  requestedQuantity: z.number({ error: "Requested quantity must be a whole number" }).int("Requested quantity must be a whole number").min(1, "Request at least 1").max(10_000),
  completedQuantity: z.number().int("Completed quantity must be a whole number").min(0, "Completed quantity cannot be negative").max(10_000).optional(),
  status: z.enum(PRINT_STATUSES).optional(),
  priority: z.enum(PRINT_PRIORITIES).optional(),
  notes: optText(10_000),
  linkedRecordIds: z.array(zId).max(50).optional(),
};
export const zPrintJobCreate = z.strictObject(printFields);
export const zPrintJobUpdate = z.strictObject({
  expectedRevision: revision,
  ...Object.fromEntries(Object.entries(printFields).map(([k, v]) => [k, (v as z.ZodType).optional()])),
} as { expectedRevision: typeof revision } & { [K in keyof typeof printFields]: z.ZodOptional<(typeof printFields)[K]> });
export const zPrintAttempt = z.strictObject({
  expectedRevision: revision,
  outcome: z.enum(["succeeded", "failed"]),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Record at least 1 piece").max(10_000),
  note: optText(2000),
});

const zBuildLink = z.strictObject({ label: z.string().trim().min(1).max(120), url: z.string().max(2048) });
const buildFields = {
  title: z.string().trim().min(1, "Enter a title").max(200),
  category: z.enum(BUILD_CATEGORIES),
  purpose: optText(2000),
  status: z.enum(BUILD_STATUSES).optional(),
  links: z.array(zBuildLink).max(30).optional(),
  notes: optText(10_000),
  linkedRecordIds: z.array(zId).max(50).optional(),
};
export const zBuildCreate = z.strictObject(buildFields);
export const zBuildUpdate = z.strictObject({
  expectedRevision: revision,
  ...Object.fromEntries(Object.entries(buildFields).map(([k, v]) => [k, (v as z.ZodType).optional()])),
} as { expectedRevision: typeof revision } & { [K in keyof typeof buildFields]: z.ZodOptional<(typeof buildFields)[K]> });
export const zBuildVersion = z.strictObject({
  expectedRevision: revision,
  label: z.string().trim().min(1, "Enter a version label").max(120),
  note: optText(2000),
  url: optText(2048),
});

/** Live-owned fields per operational record (what the dashboard may write). */
export const LIVE_OWNED_FIELDS = {
  session_state: ["status", "scheduledFor", "actualRunDate"],
  checklist_item: ["subjectId", "label", "done", "sortOrder"],
  gm_note: ["subjectId", "body"],
  print_job: Object.keys(printFields),
  print_attempt: ["outcome", "quantity", "note"],
  build: [...Object.keys(buildFields), "versions"],
} as const;

// -------------------------------------------------------------- validation

export type FieldErrors = Record<string, string>;

export function parseInput<T extends z.ZodType>(schema: T, input: unknown, sourceOwnedHint?: readonly string[]): z.infer<T> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new DomainError("INVALID_INPUT", "Request body must be a JSON object.");
  }
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const unknownKeys = result.error.issues.flatMap((i) => (i.code === "unrecognized_keys" ? i.keys : []));
  if (unknownKeys.length) {
    const owned = sourceOwnedHint ? unknownKeys.filter((k) => sourceOwnedHint.includes(k)) : [];
    throw new DomainError(
      "FIELD_NOT_ALLOWED",
      owned.length
        ? `${owned.join(", ")} ${owned.length === 1 ? "is" : "are"} source-owned (published from Space Pages) and cannot be changed from the dashboard.`
        : `Field(s) not allowed here: ${unknownKeys.join(", ")}.`,
      { fields: unknownKeys },
    );
  }
  const fieldErrors: FieldErrors = {};
  for (const i of result.error.issues) {
    const key = i.path.join(".") || "_";
    fieldErrors[key] ??= i.message;
  }
  throw new DomainError("INVALID_INPUT", "Some fields need attention.", { fieldErrors });
}

function fieldError(field: string, message: string): never {
  throw new DomainError("INVALID_INPUT", message, { fieldErrors: { [field]: message } });
}

function checkUrlField(field: string, value: string | null | undefined) {
  if (!value) return;
  const check = checkExternalUrl(value);
  if (!check.ok) fieldError(field, `Link is not allowed: ${check.reason}.`);
}

function unwrap<T>(result: CasResult<T>, what: string): T {
  if (result.status === "ok") return result.value;
  if (result.status === "not_found") throw new DomainError("NOT_FOUND", `${what} not found.`);
  throw new DomainError("REVISION_CONFLICT", `${what} was changed elsewhere. Reload to see the latest version, then try again.`, { current: result.current });
}

// ----------------------------------------------------------------- service

export interface OperationsDeps {
  store: OperationalStore;
  projectId: string;
  getPublishedState: () => Promise<PublishedState>;
  now?: () => string;
  newId?: () => string;
  demo?: boolean;
}

export class OperationsService {
  private readonly store: OperationalStore;
  private readonly projectId: string;
  private readonly getPublishedState: () => Promise<PublishedState>;
  private readonly now: () => string;
  private readonly newId: () => string;
  /** Records created in demo mode carry demo: true. */
  private readonly demo: boolean;

  constructor(deps: OperationsDeps) {
    this.store = deps.store;
    this.projectId = deps.projectId;
    this.getPublishedState = deps.getPublishedState;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
    this.demo = deps.demo ?? false;
  }

  private async requireRecord(id: string, allowed: string[], field: string) {
    const state = await this.getPublishedState();
    const rs = state.records[id];
    if (!rs || !allowed.includes(rs.type)) fieldError(field, `No ${allowed.join(" or ")} with ID ${id} exists.`);
    return rs;
  }

  private async requireLinks(ids: string[] | undefined, field: string) {
    if (!ids?.length) return;
    const state = await this.getPublishedState();
    for (const id of ids) {
      const rs = state.records[id];
      if (!rs || rs.type === "relationship" || rs.type === "source") fieldError(field, `Linked record ${id} does not exist.`);
    }
  }

  private async log(kind: string, summary: string, subjectId: string | null, actor: Actor) {
    const event: ActivityEvent = { id: this.newId(), projectId: this.projectId, at: this.now(), kind, summary, subjectId, actorLabel: actor.label, demo: this.demo };
    await this.store.insertActivity(event);
  }

  // ---- sessions

  async updateSessionState(sessionId: string, input: unknown, actor: Actor): Promise<SessionState> {
    const patch = parseInput(zSessionStatePatch, input, SOURCE_OWNED_FIELDS.session);
    const rs = await this.requireRecord(sessionId, ["session"], "sessionId");
    const current = await this.store.getSessionState(sessionId);
    const base: SessionState = current ?? {
      sessionId,
      projectId: this.projectId,
      status: "planned",
      scheduledFor: null,
      actualRunDate: null,
      revision: 0,
      demo: this.demo,
      updatedAt: null,
    };
    const next: SessionState = {
      ...base,
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.scheduledFor !== undefined && { scheduledFor: patch.scheduledFor }),
      ...(patch.actualRunDate !== undefined && { actualRunDate: patch.actualRunDate }),
      revision: patch.expectedRevision + 1,
      updatedAt: this.now(),
    };
    const saved = unwrap(await this.store.saveSessionState(next, patch.expectedRevision), "Session state");
    const title = recordTitle(rs.record, rs.tombstone?.lastTitle ?? "session");
    if (patch.status && patch.status !== base.status) await this.log("session.status", `Session "${title}" marked ${patch.status.replace("_", " ")}`, sessionId, actor);
    else await this.log("session.updated", `Session "${title}" schedule updated`, sessionId, actor);
    return saved;
  }

  // ---- checklist

  async createChecklistItem(input: unknown, actor: Actor): Promise<ChecklistItem> {
    const data = parseInput(zChecklistCreate, input);
    await this.requireRecord(data.subjectId, ["session", "story"], "subjectId");
    const siblings = await this.store.listChecklistItems(data.subjectId);
    const at = this.now();
    const item = await this.store.insertChecklistItem({
      id: this.newId(),
      projectId: this.projectId,
      subjectId: data.subjectId,
      label: data.label,
      done: false,
      sortOrder: siblings.reduce((m, s) => Math.max(m, s.sortOrder + 1), 0),
      revision: 1,
      demo: this.demo,
      createdAt: at,
      updatedAt: at,
    });
    await this.log("checklist.created", `Prep item added: "${item.label}"`, data.subjectId, actor);
    return item;
  }

  async updateChecklistItem(id: string, input: unknown, actor: Actor): Promise<ChecklistItem> {
    const patch = parseInput(zChecklistUpdate, input);
    const current = await this.store.getChecklistItem(id);
    if (!current) throw new DomainError("NOT_FOUND", "Checklist item not found.");
    const next: ChecklistItem = {
      ...current,
      ...(patch.label !== undefined && { label: patch.label }),
      ...(patch.done !== undefined && { done: patch.done }),
      ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      revision: patch.expectedRevision + 1,
      updatedAt: this.now(),
    };
    const saved = unwrap(await this.store.saveChecklistItem(next, patch.expectedRevision), "Checklist item");
    if (patch.done !== undefined && patch.done !== current.done) {
      await this.log(patch.done ? "checklist.completed" : "checklist.reopened", `Prep item ${patch.done ? "completed" : "reopened"}: "${saved.label}"`, saved.subjectId, actor);
    } else {
      await this.log("checklist.updated", `Prep item updated: "${saved.label}"`, saved.subjectId, actor);
    }
    return saved;
  }

  async deleteChecklistItem(id: string, input: unknown, actor: Actor): Promise<void> {
    const { expectedRevision } = parseInput(zChecklistDelete, input);
    const current = await this.store.getChecklistItem(id);
    if (!current) throw new DomainError("NOT_FOUND", "Checklist item not found.");
    unwrap(await this.store.deleteChecklistItem(id, expectedRevision), "Checklist item");
    await this.log("checklist.deleted", `Prep item removed: "${current.label}"`, current.subjectId, actor);
  }

  // ---- GM notes (append-only in the MVP)

  async addGmNote(input: unknown, actor: Actor): Promise<GmNote> {
    const data = parseInput(zGmNoteCreate, input);
    await this.requireRecord(data.subjectId, ["session", "story", "story_part", "entity", "media", "open_question"], "subjectId");
    const note = await this.store.insertGmNote({
      id: this.newId(),
      projectId: this.projectId,
      subjectId: data.subjectId,
      body: data.body,
      demo: this.demo,
      createdAt: this.now(),
      authorLabel: actor.label,
    });
    // Never copy note text into the activity log.
    await this.log("gm_note.added", "Private GM note added", data.subjectId, actor);
    return note;
  }

  // ---- print jobs

  async createPrintJob(input: unknown, actor: Actor): Promise<PrintJob> {
    const data = parseInput(zPrintJobCreate, input);
    checkUrlField("sourceUrl", data.sourceUrl);
    await this.requireLinks(data.linkedRecordIds, "linkedRecordIds");
    const at = this.now();
    const job: PrintJob = {
      id: this.newId(),
      projectId: this.projectId,
      title: data.title,
      sourceUrl: data.sourceUrl || null,
      fileReference: data.fileReference || null,
      fileFormat: data.fileFormat || null,
      printerProfile: data.printerProfile || null,
      material: data.material || null,
      scale: data.scale || null,
      dimensions: data.dimensions ?? null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      actualMinutes: data.actualMinutes ?? null,
      requestedQuantity: data.requestedQuantity,
      completedQuantity: data.completedQuantity ?? 0,
      failedQuantity: 0,
      status: data.status ?? "planned",
      priority: data.priority ?? "normal",
      notes: data.notes || null,
      linkedRecordIds: data.linkedRecordIds ?? [],
      revision: 1,
      demo: this.demo,
      createdAt: at,
      updatedAt: at,
    };
    checkPrintRules(job);
    const saved = await this.store.insertPrintJob(job);
    await this.log("print.created", `Print job added: "${saved.title}"`, saved.id, actor);
    return saved;
  }

  async updatePrintJob(id: string, input: unknown, actor: Actor): Promise<PrintJob> {
    const patch = parseInput(zPrintJobUpdate, input);
    const current = await this.store.getPrintJob(id);
    if (!current) throw new DomainError("NOT_FOUND", "Print job not found.");
    checkUrlField("sourceUrl", patch.sourceUrl);
    await this.requireLinks(patch.linkedRecordIds, "linkedRecordIds");
    const { expectedRevision, ...fields } = patch;
    const next: PrintJob = { ...current, revision: expectedRevision + 1, updatedAt: this.now() };
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      (next as unknown as Record<string, unknown>)[k] = typeof v === "string" && v === "" ? null : v;
    }
    checkPrintRules(next);
    const saved = unwrap(await this.store.savePrintJob(next, expectedRevision), "Print job");
    const summary = patch.status && patch.status !== current.status ? `Print "${saved.title}" moved to ${saved.status.replace("_", "-")}` : `Print "${saved.title}" updated`;
    await this.log("print.updated", summary, saved.id, actor);
    return saved;
  }

  /**
   * Reprint/retry rule: attempts never change requestedQuantity.
   *  - succeeded: completedQuantity += quantity (capped by requested → error if exceeded)
   *  - failed:    failedQuantity += quantity (a tally; the pieces still need printing)
   */
  async recordPrintAttempt(id: string, input: unknown, actor: Actor): Promise<PrintJob> {
    const data = parseInput(zPrintAttempt, input);
    const current = await this.store.getPrintJob(id);
    if (!current) throw new DomainError("NOT_FOUND", "Print job not found.");
    const next: PrintJob = { ...current, revision: data.expectedRevision + 1, updatedAt: this.now() };
    if (data.outcome === "succeeded") {
      const remaining = current.requestedQuantity - current.completedQuantity;
      if (data.quantity > remaining) {
        fieldError(
          "quantity",
          remaining === 0
            ? "All requested pieces are already complete. Raise the requested quantity first if you need extras."
            : `Only ${remaining} piece${remaining === 1 ? "" : "s"} remain. Raise the requested quantity first if you printed extras.`,
        );
      }
      next.completedQuantity += data.quantity;
    } else {
      next.failedQuantity += data.quantity;
    }
    const attempt: PrintAttempt = { id: this.newId(), printJobId: id, outcome: data.outcome, quantity: data.quantity, note: data.note || null, recordedAt: this.now() };
    const saved = unwrap(await this.store.recordPrintAttempt(next, data.expectedRevision, attempt), "Print job");
    await this.log("print.attempt", `${data.quantity} piece${data.quantity === 1 ? "" : "s"} ${data.outcome} for "${saved.title}"`, saved.id, actor);
    return saved;
  }

  // ---- Workshop builds

  async createBuild(input: unknown, actor: Actor): Promise<BuildRecord> {
    const data = parseInput(zBuildCreate, input);
    data.links?.forEach((l, i) => checkUrlField(`links.${i}.url`, l.url));
    await this.requireLinks(data.linkedRecordIds, "linkedRecordIds");
    const at = this.now();
    const build = await this.store.insertBuild({
      id: this.newId(),
      projectId: this.projectId,
      title: data.title,
      category: data.category,
      purpose: data.purpose || null,
      status: data.status ?? "idea",
      links: data.links ?? [],
      versions: [],
      notes: data.notes || null,
      linkedRecordIds: data.linkedRecordIds ?? [],
      revision: 1,
      demo: this.demo,
      createdAt: at,
      updatedAt: at,
    });
    await this.log("build.created", `Build added: "${build.title}"`, build.id, actor);
    return build;
  }

  async updateBuild(id: string, input: unknown, actor: Actor): Promise<BuildRecord> {
    const patch = parseInput(zBuildUpdate, input);
    const current = await this.store.getBuild(id);
    if (!current) throw new DomainError("NOT_FOUND", "Build not found.");
    patch.links?.forEach((l, i) => checkUrlField(`links.${i}.url`, l.url));
    await this.requireLinks(patch.linkedRecordIds, "linkedRecordIds");
    const { expectedRevision, ...fields } = patch;
    const next: BuildRecord = { ...current, revision: expectedRevision + 1, updatedAt: this.now() };
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      (next as unknown as Record<string, unknown>)[k] = typeof v === "string" && v === "" ? null : v;
    }
    const saved = unwrap(await this.store.saveBuild(next, expectedRevision), "Build");
    await this.log("build.updated", `Build "${saved.title}" updated`, saved.id, actor);
    return saved;
  }

  async addBuildVersion(id: string, input: unknown, actor: Actor): Promise<BuildRecord> {
    const data = parseInput(zBuildVersion, input);
    checkUrlField("url", data.url);
    const current = await this.store.getBuild(id);
    if (!current) throw new DomainError("NOT_FOUND", "Build not found.");
    const next: BuildRecord = {
      ...current,
      versions: [...current.versions, { id: this.newId(), label: data.label, note: data.note || null, url: data.url || null, recordedAt: this.now() }],
      revision: data.expectedRevision + 1,
      updatedAt: this.now(),
    };
    const saved = unwrap(await this.store.saveBuild(next, data.expectedRevision), "Build");
    await this.log("build.version", `Version "${data.label}" recorded for "${saved.title}"`, saved.id, actor);
    return saved;
  }
}

/** Quantity and status rules for print jobs, with actionable messages. */
export function checkPrintRules(job: PrintJob) {
  if (job.completedQuantity > job.requestedQuantity) {
    fieldError(
      "completedQuantity",
      `Completed (${job.completedQuantity}) can't exceed requested (${job.requestedQuantity}). Raise the requested quantity if you printed extras.`,
    );
  }
  if (job.status === "complete" && job.completedQuantity < job.requestedQuantity) {
    const left = job.requestedQuantity - job.completedQuantity;
    fieldError("status", `${left} piece${left === 1 ? " is" : "s are"} still outstanding. Record them as completed, or lower the requested quantity, before marking complete.`);
  }
}
