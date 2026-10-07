import "server-only";
/**
 * Supabase implementation of the storage ports.
 *
 * Constructed per request with a client that carries the signed-in GM's
 * session (RLS applies to every query), or, for the future machine publisher
 * only, with a server-side service-role client. All business rules live in
 * the shared services; this adapter only maps rows.
 *
 * STATUS: written against the migrations in supabase/migrations and the
 * supabase-js v2 API, but not yet exercised against a live Supabase project
 * (see docs/TEST_REPORT.md).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/lib/domain/errors";
import type { CasResult, CommitResult, NewRelease, OperationalStore, PublicationStore } from "@/lib/domain/ports";
import type {
  ActivityEvent,
  BuildRecord,
  ChecklistItem,
  GmNote,
  PrintAttempt,
  PrintJob,
  ProjectInfo,
  PublicationEvent,
  PublishedState,
  RecordState,
  ReleaseInfo,
  SessionState,
} from "@/lib/domain/types";

type Row = Record<string, unknown>;
const PAGE = 1000;

function fail(context: string, error: { message: string; code?: string } | null): never {
  // Log the code only; Postgres messages may echo submitted content.
  console.error(`[supabase] ${context} failed`, error?.code ?? "unknown");
  if (error?.code === "42501") throw new DomainError("FORBIDDEN", "Not authorized for this project.");
  throw new DomainError("INTERNAL", `Database error during ${context}.`);
}

const releaseFromRow = (r: Row): ReleaseInfo => ({
  id: r.id as string,
  projectId: r.project_id as string,
  version: r.version as number,
  kind: r.kind as ReleaseInfo["kind"],
  baseReleaseId: (r.base_release_id as string) ?? null,
  rollbackOfReleaseId: (r.rollback_of_release_id as string) ?? null,
  bundleHash: r.bundle_hash as string,
  schemaVersion: r.schema_version as string,
  createdAt: new Date(r.created_at as string).toISOString(),
  publishedAt: new Date(r.published_at as string).toISOString(),
  publishedBy: r.published_by as ReleaseInfo["publishedBy"],
  title: (r.title as string) ?? null,
  notes: (r.notes as string) ?? null,
  counts: r.counts as ReleaseInfo["counts"],
});

const recordFromRow = (r: Row): RecordState => ({
  id: r.record_id as string,
  type: r.record_type as RecordState["type"],
  lifecycle: r.lifecycle as RecordState["lifecycle"],
  record: (r.data as RecordState["record"]) ?? null,
  tombstone: (r.tombstone as RecordState["tombstone"]) ?? null,
  contentHash: (r.content_hash as string) ?? null,
  introducedIn: r.introduced_in as string,
  changedIn: r.changed_in as string,
});

const sessionFromRow = (r: Row): SessionState => ({
  sessionId: r.session_id as string,
  projectId: r.project_id as string,
  status: r.status as SessionState["status"],
  scheduledFor: (r.scheduled_for as string) ?? null,
  actualRunDate: (r.actual_run_date as string) ?? null,
  revision: r.revision as number,
  demo: r.demo as boolean,
  updatedAt: (r.updated_at as string) ?? null,
});

const checklistFromRow = (r: Row): ChecklistItem => ({
  id: r.id as string,
  projectId: r.project_id as string,
  subjectId: r.subject_id as string,
  label: r.label as string,
  done: r.done as boolean,
  sortOrder: r.sort_order as number,
  revision: r.revision as number,
  demo: r.demo as boolean,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const printFromRow = (r: Row): PrintJob => ({
  id: r.id as string,
  projectId: r.project_id as string,
  title: r.title as string,
  sourceUrl: (r.source_url as string) ?? null,
  fileReference: (r.file_reference as string) ?? null,
  fileFormat: (r.file_format as string) ?? null,
  printerProfile: (r.printer_profile as string) ?? null,
  material: (r.material as string) ?? null,
  scale: (r.scale as string) ?? null,
  dimensions: (r.dimensions as PrintJob["dimensions"]) ?? null,
  estimatedMinutes: (r.estimated_minutes as number) ?? null,
  actualMinutes: (r.actual_minutes as number) ?? null,
  requestedQuantity: r.requested_quantity as number,
  completedQuantity: r.completed_quantity as number,
  failedQuantity: r.failed_quantity as number,
  status: r.status as PrintJob["status"],
  priority: r.priority as PrintJob["priority"],
  notes: (r.notes as string) ?? null,
  linkedRecordIds: (r.linked_record_ids as string[]) ?? [],
  revision: r.revision as number,
  demo: r.demo as boolean,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const printToRow = (p: PrintJob): Row => ({
  id: p.id,
  project_id: p.projectId,
  title: p.title,
  source_url: p.sourceUrl,
  file_reference: p.fileReference,
  file_format: p.fileFormat,
  printer_profile: p.printerProfile,
  material: p.material,
  scale: p.scale,
  dimensions: p.dimensions,
  estimated_minutes: p.estimatedMinutes,
  actual_minutes: p.actualMinutes,
  requested_quantity: p.requestedQuantity,
  completed_quantity: p.completedQuantity,
  failed_quantity: p.failedQuantity,
  status: p.status,
  priority: p.priority,
  notes: p.notes,
  linked_record_ids: p.linkedRecordIds,
  revision: p.revision,
  demo: p.demo,
});

const buildFromRow = (r: Row): BuildRecord => ({
  id: r.id as string,
  projectId: r.project_id as string,
  title: r.title as string,
  category: r.category as BuildRecord["category"],
  purpose: (r.purpose as string) ?? null,
  status: r.status as BuildRecord["status"],
  links: (r.links as BuildRecord["links"]) ?? [],
  versions: (r.versions as BuildRecord["versions"]) ?? [],
  notes: (r.notes as string) ?? null,
  linkedRecordIds: (r.linked_record_ids as string[]) ?? [],
  revision: r.revision as number,
  demo: r.demo as boolean,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const buildToRow = (b: BuildRecord): Row => ({
  id: b.id,
  project_id: b.projectId,
  title: b.title,
  category: b.category,
  purpose: b.purpose,
  status: b.status,
  links: b.links,
  versions: b.versions,
  notes: b.notes,
  linked_record_ids: b.linkedRecordIds,
  revision: b.revision,
  demo: b.demo,
});

export class SupabaseStore implements PublicationStore, OperationalStore {
  constructor(
    private readonly db: SupabaseClient,
    private readonly projectId: string,
  ) {}

  // ------------------------------------------------------------ publication

  async getProject(): Promise<ProjectInfo> {
    const { data, error } = await this.db.from("projects").select("id,name,active_release_id,release_count").eq("id", this.projectId).maybeSingle();
    if (error) fail("getProject", error);
    if (!data) throw new DomainError("FORBIDDEN", "Project not found or not accessible.");
    return { id: data.id, name: data.name, activeReleaseId: data.active_release_id, releaseCount: data.release_count };
  }

  private async snapshot(releaseId: string): Promise<RecordState[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db
        .from("release_records")
        .select("record_id,record_type,lifecycle,data,tombstone,content_hash,introduced_in,changed_in")
        .eq("project_id", this.projectId)
        .eq("release_id", releaseId)
        .order("record_id")
        .range(from, from + PAGE - 1);
      if (error) fail("snapshot", error);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return rows.map(recordFromRow);
  }

  async getActiveState(): Promise<PublishedState> {
    const project = await this.getProject();
    if (!project.activeReleaseId) return { releaseId: null, version: 0, records: {} };
    return (await this.getReleaseState(project.activeReleaseId))!;
  }

  async getReleaseState(releaseId: string): Promise<PublishedState | null> {
    const release = await this.getRelease(releaseId);
    if (!release) return null;
    const records = await this.snapshot(releaseId);
    return { releaseId, version: release.version, records: Object.fromEntries(records.map((r) => [r.id, r])) };
  }

  async getRelease(releaseId: string): Promise<ReleaseInfo | null> {
    const { data, error } = await this.db.from("releases").select("*").eq("project_id", this.projectId).eq("id", releaseId).maybeSingle();
    if (error) fail("getRelease", error);
    return data ? releaseFromRow(data) : null;
  }

  async listReleases(): Promise<ReleaseInfo[]> {
    const { data, error } = await this.db.from("releases").select("*").eq("project_id", this.projectId).order("version", { ascending: false }).limit(200);
    if (error) fail("listReleases", error);
    return (data ?? []).map(releaseFromRow);
  }

  async commitRelease(release: NewRelease, records: RecordState[]): Promise<CommitResult> {
    const { data, error } = await this.db.rpc("tide_commit_release", { p_project_id: this.projectId, p_release: release, p_records: records });
    if (error) fail("commitRelease", error);
    const result = data as { status: string; code?: string; activeReleaseId?: string | null; release?: Row };
    if (result.status === "applied" || result.status === "replayed") {
      return { status: result.status, release: releaseFromRow(camelReleaseToRow(result.release!)) };
    }
    return { status: "conflict", code: result.code as "STALE_BASE" | "RELEASE_ID_CONFLICT", activeReleaseId: result.activeReleaseId ?? null };
  }

  async recordPublicationEvent(event: Omit<PublicationEvent, "id" | "at">): Promise<void> {
    if (event.outcome === "applied") return; // written inside tide_commit_release
    const { error } = await this.db.rpc("tide_record_publication_event", {
      p_project_id: this.projectId,
      p_release_id: event.releaseId,
      p_outcome: event.outcome,
      p_code: event.code,
      p_counts: event.counts,
    });
    if (error) fail("recordPublicationEvent", error);
  }

  async listPublicationEvents(limit: number): Promise<PublicationEvent[]> {
    const { data, error } = await this.db.from("publication_events").select("*").eq("project_id", this.projectId).order("at", { ascending: false }).limit(limit);
    if (error) fail("listPublicationEvents", error);
    return (data ?? []).map((r) => ({ id: r.id, at: r.at, releaseId: r.release_id, outcome: r.outcome, code: r.code, actor: r.actor, counts: r.counts }));
  }

  // ------------------------------------------------------------ operational

  private async casUpdate<T>(table: string, key: string, id: string, row: Row, expectedRevision: number, map: (r: Row) => T): Promise<CasResult<T>> {
    const { data, error } = await this.db.from(table).update(row).eq("project_id", this.projectId).eq(key, id).eq("revision", expectedRevision).select("*");
    if (error) fail(`update ${table}`, error);
    if (data && data.length === 1) return { status: "ok", value: map(data[0]!) };
    const { data: current, error: e2 } = await this.db.from(table).select("*").eq("project_id", this.projectId).eq(key, id).maybeSingle();
    if (e2) fail(`reload ${table}`, e2);
    return current ? { status: "conflict", current: map(current) } : { status: "not_found" };
  }

  async listSessionStates() {
    const { data, error } = await this.db.from("session_states").select("*").eq("project_id", this.projectId);
    if (error) fail("listSessionStates", error);
    return (data ?? []).map(sessionFromRow);
  }
  async getSessionState(sessionId: string) {
    const { data, error } = await this.db.from("session_states").select("*").eq("project_id", this.projectId).eq("session_id", sessionId).maybeSingle();
    if (error) fail("getSessionState", error);
    return data ? sessionFromRow(data) : null;
  }
  async saveSessionState(next: SessionState, expectedRevision: number): Promise<CasResult<SessionState>> {
    const row = { status: next.status, scheduled_for: next.scheduledFor, actual_run_date: next.actualRunDate, revision: next.revision };
    if (expectedRevision === 0) {
      const { data, error } = await this.db
        .from("session_states")
        .insert({ ...row, session_id: next.sessionId, project_id: this.projectId, demo: next.demo })
        .select("*")
        .single();
      if (error?.code === "23505") return { status: "conflict", current: await this.getSessionState(next.sessionId) };
      if (error) fail("insert session_states", error);
      return { status: "ok", value: sessionFromRow(data) };
    }
    return this.casUpdate("session_states", "session_id", next.sessionId, row, expectedRevision, sessionFromRow);
  }

  async listChecklistItems(subjectId?: string) {
    let q = this.db.from("checklist_items").select("*").eq("project_id", this.projectId);
    if (subjectId) q = q.eq("subject_id", subjectId);
    const { data, error } = await q.order("sort_order");
    if (error) fail("listChecklistItems", error);
    return (data ?? []).map(checklistFromRow);
  }
  async getChecklistItem(id: string) {
    const { data, error } = await this.db.from("checklist_items").select("*").eq("project_id", this.projectId).eq("id", id).maybeSingle();
    if (error) fail("getChecklistItem", error);
    return data ? checklistFromRow(data) : null;
  }
  async insertChecklistItem(item: ChecklistItem) {
    const { data, error } = await this.db
      .from("checklist_items")
      .insert({ id: item.id, project_id: this.projectId, subject_id: item.subjectId, label: item.label, done: item.done, sort_order: item.sortOrder, revision: 1, demo: item.demo })
      .select("*")
      .single();
    if (error) fail("insertChecklistItem", error);
    return checklistFromRow(data);
  }
  saveChecklistItem(next: ChecklistItem, expectedRevision: number) {
    return this.casUpdate("checklist_items", "id", next.id, { label: next.label, done: next.done, sort_order: next.sortOrder, revision: next.revision }, expectedRevision, checklistFromRow);
  }
  async deleteChecklistItem(id: string, expectedRevision: number): Promise<CasResult<null>> {
    const { data, error } = await this.db.from("checklist_items").delete().eq("project_id", this.projectId).eq("id", id).eq("revision", expectedRevision).select("id");
    if (error) fail("deleteChecklistItem", error);
    if (data?.length) return { status: "ok", value: null };
    return (await this.getChecklistItem(id)) ? { status: "conflict", current: null } : { status: "not_found" };
  }

  async listGmNotes(subjectId?: string) {
    let q = this.db.from("gm_notes").select("*").eq("project_id", this.projectId);
    if (subjectId) q = q.eq("subject_id", subjectId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) fail("listGmNotes", error);
    return (data ?? []).map((r) => ({ id: r.id, projectId: r.project_id, subjectId: r.subject_id, body: r.body, demo: r.demo, createdAt: r.created_at, authorLabel: r.author_label }) as GmNote);
  }
  async insertGmNote(note: GmNote) {
    const { error } = await this.db.from("gm_notes").insert({ id: note.id, project_id: this.projectId, subject_id: note.subjectId, body: note.body, demo: note.demo, author_label: note.authorLabel });
    if (error) fail("insertGmNote", error);
    return note;
  }

  async listPrintJobs() {
    const { data, error } = await this.db.from("print_jobs").select("*").eq("project_id", this.projectId);
    if (error) fail("listPrintJobs", error);
    return (data ?? []).map(printFromRow);
  }
  async getPrintJob(id: string) {
    const { data, error } = await this.db.from("print_jobs").select("*").eq("project_id", this.projectId).eq("id", id).maybeSingle();
    if (error) fail("getPrintJob", error);
    return data ? printFromRow(data) : null;
  }
  async insertPrintJob(job: PrintJob) {
    const { data, error } = await this.db.from("print_jobs").insert(printToRow({ ...job, projectId: this.projectId })).select("*").single();
    if (error) fail("insertPrintJob", error);
    return printFromRow(data);
  }
  savePrintJob(next: PrintJob, expectedRevision: number) {
    const { id: _id, project_id: _p, demo: _d, ...row } = printToRow(next);
    void _id;
    void _p;
    void _d;
    return this.casUpdate("print_jobs", "id", next.id, row, expectedRevision, printFromRow);
  }
  async recordPrintAttempt(next: PrintJob, expectedRevision: number, attempt: PrintAttempt): Promise<CasResult<PrintJob>> {
    const { data, error } = await this.db.rpc("tide_record_print_attempt", {
      p_job_id: next.id,
      p_expected_revision: expectedRevision,
      p_completed: next.completedQuantity,
      p_failed: next.failedQuantity,
      p_attempt_id: attempt.id,
      p_outcome: attempt.outcome,
      p_quantity: attempt.quantity,
      p_note: attempt.note,
    });
    if (error) fail("recordPrintAttempt", error);
    const status = (data as { status: string }).status;
    const current = await this.getPrintJob(next.id);
    if (status === "ok" && current) return { status: "ok", value: current };
    if (status === "not_found" || !current) return { status: "not_found" };
    return { status: "conflict", current };
  }
  async listPrintAttempts(printJobId: string) {
    const { data, error } = await this.db.from("print_attempts").select("*").eq("project_id", this.projectId).eq("print_job_id", printJobId).order("recorded_at", { ascending: false });
    if (error) fail("listPrintAttempts", error);
    return (data ?? []).map((r) => ({ id: r.id, printJobId: r.print_job_id, outcome: r.outcome, quantity: r.quantity, note: r.note, recordedAt: r.recorded_at }) as PrintAttempt);
  }

  async listBuilds() {
    const { data, error } = await this.db.from("builds").select("*").eq("project_id", this.projectId);
    if (error) fail("listBuilds", error);
    return (data ?? []).map(buildFromRow);
  }
  async getBuild(id: string) {
    const { data, error } = await this.db.from("builds").select("*").eq("project_id", this.projectId).eq("id", id).maybeSingle();
    if (error) fail("getBuild", error);
    return data ? buildFromRow(data) : null;
  }
  async insertBuild(build: BuildRecord) {
    const { data, error } = await this.db.from("builds").insert(buildToRow({ ...build, projectId: this.projectId })).select("*").single();
    if (error) fail("insertBuild", error);
    return buildFromRow(data);
  }
  saveBuild(next: BuildRecord, expectedRevision: number) {
    const { id: _id, project_id: _p, demo: _d, ...row } = buildToRow(next);
    void _id;
    void _p;
    void _d;
    return this.casUpdate("builds", "id", next.id, row, expectedRevision, buildFromRow);
  }

  async listActivity(limit: number) {
    const { data, error } = await this.db.from("activity_events").select("*").eq("project_id", this.projectId).order("at", { ascending: false }).limit(limit);
    if (error) fail("listActivity", error);
    return (data ?? []).map((r) => ({ id: r.id, projectId: r.project_id, at: r.at, kind: r.kind, summary: r.summary, subjectId: r.subject_id, actorLabel: r.actor_label, demo: r.demo }) as ActivityEvent);
  }
  async insertActivity(event: ActivityEvent) {
    const { error } = await this.db.from("activity_events").insert({
      id: event.id,
      project_id: this.projectId,
      kind: event.kind,
      summary: event.summary,
      subject_id: event.subjectId,
      actor_label: event.actorLabel,
      demo: event.demo,
    });
    if (error) fail("insertActivity", error);
  }
}

/** tide_release_json returns camelCase; normalize back through the row mapper. */
function camelReleaseToRow(r: Row): Row {
  return {
    id: r.id,
    project_id: r.projectId,
    version: r.version,
    kind: r.kind,
    base_release_id: r.baseReleaseId,
    rollback_of_release_id: r.rollbackOfReleaseId,
    bundle_hash: r.bundleHash,
    schema_version: r.schemaVersion,
    created_at: r.createdAt,
    published_at: r.publishedAt,
    published_by: r.publishedBy,
    title: r.title,
    notes: r.notes,
    counts: r.counts,
  };
}
