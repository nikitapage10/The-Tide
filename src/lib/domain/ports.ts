/**
 * Storage ports. Every adapter (memory, local demo file, Supabase) implements
 * these; all business rules live in the services that use them, so the demo
 * and connected implementations cannot drift.
 *
 * The publication store never touches operational records and the
 * operational store never touches published records.
 */
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
} from "./types";

export type NewRelease = Omit<ReleaseInfo, "version" | "publishedAt">;

export type CommitResult =
  | { status: "applied"; release: ReleaseInfo }
  | { status: "replayed"; release: ReleaseInfo }
  | { status: "conflict"; code: "STALE_BASE" | "RELEASE_ID_CONFLICT"; activeReleaseId: string | null };

export interface PublicationStore {
  getProject(): Promise<ProjectInfo>;
  getActiveState(): Promise<PublishedState>;
  getReleaseState(releaseId: string): Promise<PublishedState | null>;
  getRelease(releaseId: string): Promise<ReleaseInfo | null>;
  listReleases(): Promise<ReleaseInfo[]>;
  /**
   * Atomically: re-check idempotency and base (compare-and-swap), assign the
   * next version and publication timestamp, store the full snapshot and switch
   * the active release. Either all of it happens or none of it does.
   */
  commitRelease(release: NewRelease, records: RecordState[]): Promise<CommitResult>;
  recordPublicationEvent(event: Omit<PublicationEvent, "id" | "at">): Promise<void>;
  listPublicationEvents(limit: number): Promise<PublicationEvent[]>;
}

/** Result of a compare-and-swap write. */
export type CasResult<T> = { status: "ok"; value: T } | { status: "conflict"; current: T | null } | { status: "not_found" };

export interface OperationalStore {
  listSessionStates(): Promise<SessionState[]>;
  getSessionState(sessionId: string): Promise<SessionState | null>;
  /** expectedRevision 0 means "create"; fails with conflict if a row already exists. */
  saveSessionState(next: SessionState, expectedRevision: number): Promise<CasResult<SessionState>>;

  listChecklistItems(subjectId?: string): Promise<ChecklistItem[]>;
  getChecklistItem(id: string): Promise<ChecklistItem | null>;
  insertChecklistItem(item: ChecklistItem): Promise<ChecklistItem>;
  saveChecklistItem(next: ChecklistItem, expectedRevision: number): Promise<CasResult<ChecklistItem>>;
  deleteChecklistItem(id: string, expectedRevision: number): Promise<CasResult<null>>;

  listGmNotes(subjectId?: string): Promise<GmNote[]>;
  insertGmNote(note: GmNote): Promise<GmNote>;

  listPrintJobs(): Promise<PrintJob[]>;
  getPrintJob(id: string): Promise<PrintJob | null>;
  insertPrintJob(job: PrintJob): Promise<PrintJob>;
  savePrintJob(next: PrintJob, expectedRevision: number): Promise<CasResult<PrintJob>>;
  /** Atomically saves the job counters (CAS) and appends the attempt. */
  recordPrintAttempt(next: PrintJob, expectedRevision: number, attempt: PrintAttempt): Promise<CasResult<PrintJob>>;
  listPrintAttempts(printJobId: string): Promise<PrintAttempt[]>;

  listBuilds(): Promise<BuildRecord[]>;
  getBuild(id: string): Promise<BuildRecord | null>;
  insertBuild(build: BuildRecord): Promise<BuildRecord>;
  saveBuild(next: BuildRecord, expectedRevision: number): Promise<CasResult<BuildRecord>>;

  listActivity(limit: number): Promise<ActivityEvent[]>;
  insertActivity(event: ActivityEvent): Promise<void>;
}
