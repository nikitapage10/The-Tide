/**
 * In-memory implementation of both storage ports.
 *
 * Used directly by tests and wrapped by the local demo file store. Every
 * write works on a cloned document and swaps it in only after the optional
 * persistence step succeeds, so a failure mid-write leaves nothing partial.
 *
 * NOT production persistence.
 */
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

export interface StoreDoc {
  formatVersion: 1;
  project: ProjectInfo;
  releases: ReleaseInfo[];
  /** Full immutable snapshot per release. */
  snapshots: Record<string, RecordState[]>;
  publicationEvents: PublicationEvent[];
  sessionStates: SessionState[];
  checklist: ChecklistItem[];
  gmNotes: GmNote[];
  printJobs: PrintJob[];
  printAttempts: PrintAttempt[];
  builds: BuildRecord[];
  activity: ActivityEvent[];
}

export function emptyDoc(project: { id: string; name: string }): StoreDoc {
  return {
    formatVersion: 1,
    project: { id: project.id, name: project.name, activeReleaseId: null, releaseCount: 0 },
    releases: [],
    snapshots: {},
    publicationEvents: [],
    sessionStates: [],
    checklist: [],
    gmNotes: [],
    printJobs: [],
    printAttempts: [],
    builds: [],
    activity: [],
  };
}

export interface MemoryStoreOptions {
  /** Called after every successful in-memory change, before it becomes visible. */
  persist?: (doc: StoreDoc) => Promise<void>;
  /** Called before each operation to pick up external changes (e.g. a reset). */
  load?: () => Promise<StoreDoc | null>;
  /** Test hook: throw from here to simulate a failure at a named stage. */
  fault?: (stage: string) => void;
  now?: () => string;
}

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryStore implements PublicationStore, OperationalStore {
  private doc: StoreDoc;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    doc: StoreDoc,
    private readonly opts: MemoryStoreOptions = {},
  ) {
    this.doc = clone(doc);
  }

  snapshotDoc(): StoreDoc {
    return clone(this.doc);
  }

  private now() {
    return this.opts.now?.() ?? new Date().toISOString();
  }

  private async read(): Promise<StoreDoc> {
    if (this.opts.load) {
      const loaded = await this.opts.load();
      if (loaded) this.doc = loaded;
    }
    return this.doc;
  }

  /** Serialized, all-or-nothing mutation. */
  private mutate<T>(fn: (draft: StoreDoc) => T): Promise<T> {
    const run = async () => {
      const draft = clone(await this.read());
      const result = fn(draft);
      if (this.opts.persist) await this.opts.persist(draft);
      this.doc = draft;
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  // ------------------------------------------------------------ publication

  async getProject(): Promise<ProjectInfo> {
    return clone((await this.read()).project);
  }

  private stateOf(doc: StoreDoc, releaseId: string | null): PublishedState | null {
    if (!releaseId) return { releaseId: null, version: 0, records: {} };
    const rel = doc.releases.find((r) => r.id === releaseId);
    const snap = doc.snapshots[releaseId];
    if (!rel || !snap) return null;
    return { releaseId, version: rel.version, records: Object.fromEntries(snap.map((r) => [r.id, clone(r)])) };
  }

  async getActiveState(): Promise<PublishedState> {
    const doc = await this.read();
    return this.stateOf(doc, doc.project.activeReleaseId)!;
  }

  async getReleaseState(releaseId: string) {
    return this.stateOf(await this.read(), releaseId);
  }

  async getRelease(releaseId: string) {
    const r = (await this.read()).releases.find((x) => x.id === releaseId);
    return r ? clone(r) : null;
  }

  async listReleases() {
    return clone((await this.read()).releases).sort((a, b) => b.version - a.version);
  }

  commitRelease(release: NewRelease, records: RecordState[]): Promise<CommitResult> {
    return this.mutate((doc): CommitResult => {
      const existing = doc.releases.find((r) => r.id === release.id);
      if (existing) {
        return existing.bundleHash === release.bundleHash
          ? { status: "replayed", release: clone(existing) }
          : { status: "conflict", code: "RELEASE_ID_CONFLICT", activeReleaseId: doc.project.activeReleaseId };
      }
      if (doc.project.activeReleaseId !== release.baseReleaseId) {
        return { status: "conflict", code: "STALE_BASE", activeReleaseId: doc.project.activeReleaseId };
      }
      const full: ReleaseInfo = { ...release, version: doc.project.releaseCount + 1, publishedAt: this.now() };
      doc.releases.push(full);
      doc.snapshots[full.id] = clone(records);
      this.opts.fault?.("commit:before-activate");
      doc.project.activeReleaseId = full.id;
      doc.project.releaseCount = full.version;
      return { status: "applied", release: clone(full) };
    });
  }

  async recordPublicationEvent(event: Omit<PublicationEvent, "id" | "at">) {
    await this.mutate((doc) => {
      doc.publicationEvents.push({ ...event, id: crypto.randomUUID(), at: this.now() });
      if (doc.publicationEvents.length > 500) doc.publicationEvents.splice(0, doc.publicationEvents.length - 500);
    });
  }

  async listPublicationEvents(limit: number) {
    return clone((await this.read()).publicationEvents).reverse().slice(0, limit);
  }

  // ------------------------------------------------------------ operational

  private cas<T extends { revision: number }>(
    list: (doc: StoreDoc) => T[],
    match: (x: T) => boolean,
    next: T,
    expectedRevision: number,
    stage: string,
  ): Promise<CasResult<T>> {
    return this.mutate((doc): CasResult<T> => {
      const arr = list(doc);
      const i = arr.findIndex(match);
      if (i < 0) return { status: "not_found" };
      if (arr[i]!.revision !== expectedRevision) return { status: "conflict", current: clone(arr[i]!) };
      this.opts.fault?.(stage);
      arr[i] = clone(next);
      return { status: "ok", value: clone(next) };
    });
  }

  async listSessionStates() {
    return clone((await this.read()).sessionStates);
  }
  async getSessionState(sessionId: string) {
    const s = (await this.read()).sessionStates.find((x) => x.sessionId === sessionId);
    return s ? clone(s) : null;
  }
  saveSessionState(next: SessionState, expectedRevision: number): Promise<CasResult<SessionState>> {
    if (expectedRevision === 0) {
      return this.mutate((doc): CasResult<SessionState> => {
        const existing = doc.sessionStates.find((x) => x.sessionId === next.sessionId);
        if (existing) return { status: "conflict", current: clone(existing) };
        doc.sessionStates.push(clone(next));
        return { status: "ok", value: clone(next) };
      });
    }
    return this.cas((d) => d.sessionStates, (x) => x.sessionId === next.sessionId, next, expectedRevision, "session");
  }

  async listChecklistItems(subjectId?: string) {
    return clone((await this.read()).checklist)
      .filter((c) => !subjectId || c.subjectId === subjectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async getChecklistItem(id: string) {
    const c = (await this.read()).checklist.find((x) => x.id === id);
    return c ? clone(c) : null;
  }
  insertChecklistItem(item: ChecklistItem) {
    return this.mutate((doc) => {
      doc.checklist.push(clone(item));
      return clone(item);
    });
  }
  saveChecklistItem(next: ChecklistItem, expectedRevision: number) {
    return this.cas((d) => d.checklist, (x) => x.id === next.id, next, expectedRevision, "checklist");
  }
  deleteChecklistItem(id: string, expectedRevision: number): Promise<CasResult<null>> {
    return this.mutate((doc): CasResult<null> => {
      const i = doc.checklist.findIndex((x) => x.id === id);
      if (i < 0) return { status: "not_found" };
      if (doc.checklist[i]!.revision !== expectedRevision) return { status: "conflict", current: null };
      doc.checklist.splice(i, 1);
      return { status: "ok", value: null };
    });
  }

  async listGmNotes(subjectId?: string) {
    return clone((await this.read()).gmNotes)
      .filter((n) => !subjectId || n.subjectId === subjectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  insertGmNote(note: GmNote) {
    return this.mutate((doc) => {
      doc.gmNotes.push(clone(note));
      return clone(note);
    });
  }

  async listPrintJobs() {
    return clone((await this.read()).printJobs);
  }
  async getPrintJob(id: string) {
    const p = (await this.read()).printJobs.find((x) => x.id === id);
    return p ? clone(p) : null;
  }
  insertPrintJob(job: PrintJob) {
    return this.mutate((doc) => {
      doc.printJobs.push(clone(job));
      return clone(job);
    });
  }
  savePrintJob(next: PrintJob, expectedRevision: number) {
    return this.cas((d) => d.printJobs, (x) => x.id === next.id, next, expectedRevision, "print");
  }
  recordPrintAttempt(next: PrintJob, expectedRevision: number, attempt: PrintAttempt): Promise<CasResult<PrintJob>> {
    return this.mutate((doc): CasResult<PrintJob> => {
      const i = doc.printJobs.findIndex((x) => x.id === next.id);
      if (i < 0) return { status: "not_found" };
      if (doc.printJobs[i]!.revision !== expectedRevision) return { status: "conflict", current: clone(doc.printJobs[i]!) };
      doc.printJobs[i] = clone(next);
      this.opts.fault?.("print-attempt");
      doc.printAttempts.push(clone(attempt));
      return { status: "ok", value: clone(next) };
    });
  }
  async listPrintAttempts(printJobId: string) {
    return clone((await this.read()).printAttempts)
      .filter((a) => a.printJobId === printJobId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }

  async listBuilds() {
    return clone((await this.read()).builds);
  }
  async getBuild(id: string) {
    const b = (await this.read()).builds.find((x) => x.id === id);
    return b ? clone(b) : null;
  }
  insertBuild(build: BuildRecord) {
    return this.mutate((doc) => {
      doc.builds.push(clone(build));
      return clone(build);
    });
  }
  saveBuild(next: BuildRecord, expectedRevision: number) {
    return this.cas((d) => d.builds, (x) => x.id === next.id, next, expectedRevision, "build");
  }

  async listActivity(limit: number) {
    return clone((await this.read()).activity)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }
  async insertActivity(event: ActivityEvent) {
    await this.mutate((doc) => {
      doc.activity.push(clone(event));
      if (doc.activity.length > 1000) doc.activity.splice(0, doc.activity.length - 1000);
    });
  }
}
