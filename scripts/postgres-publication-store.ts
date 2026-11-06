/** CI publisher using the existing database connection, without exporting credentials. */
import { spawnSync } from "node:child_process";
import type {
  PublicationStore,
  NewRelease,
  CommitResult,
} from "../src/lib/domain/ports";
import type {
  ProjectInfo,
  PublishedState,
  RecordState,
  ReleaseInfo,
  PublicationEvent,
} from "../src/lib/domain/types";

const literal = (value: unknown) =>
  "'" + String(value).replaceAll("'", "''") + "'";
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const release = (r: Record<string, unknown>): ReleaseInfo => ({
  id: String(r.id),
  projectId: String(r.project_id),
  version: Number(r.version),
  kind: r.kind as ReleaseInfo["kind"],
  baseReleaseId: (r.base_release_id as string) ?? null,
  rollbackOfReleaseId: (r.rollback_of_release_id as string) ?? null,
  bundleHash: String(r.bundle_hash),
  schemaVersion: String(r.schema_version),
  createdAt: new Date(String(r.created_at)).toISOString(),
  publishedAt: new Date(String(r.published_at)).toISOString(),
  publishedBy: r.published_by as ReleaseInfo["publishedBy"],
  title: (r.title as string) ?? null,
  notes: (r.notes as string) ?? null,
  counts: r.counts as ReleaseInfo["counts"],
});
export class PostgresPublicationStore implements PublicationStore {
  private env: NodeJS.ProcessEnv;
  constructor(
    connection: string,
    private projectId: string,
  ) {
    const url = new URL(connection);
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new Error("Invalid database protocol.");
    this.env = {
      ...process.env,
      PGHOST: url.searchParams.get("host") || url.hostname,
      PGPORT: url.port || url.searchParams.get("port") || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGSSLMODE: "require",
      PGCONNECT_TIMEOUT: "20",
    };
  }
  private query<T>(sql: string): T {
    // Connection credentials are environment-only; SQL and JSON travel over stdin.
    const result = spawnSync(
      "psql",
      ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        env: this.env,
        input: `begin; set local request.jwt.claims = '{"role":"service_role"}';\n${sql};\ncommit;`,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        timeout: 60000,
      },
    );
    if (result.status !== 0 || result.error)
      throw new Error(
        "Database publication query failed. Credentials and submitted text have been omitted.",
      );
    return JSON.parse(result.stdout.trim() || "null") as T;
  }
  async getProject(): Promise<ProjectInfo> {
    const p = this.query<Record<string, unknown> | null>(
      `select (select row_to_json(p) from public.projects p where id=${literal(this.projectId)}::uuid)`,
    );
    if (!p) throw new Error("Publication project not found.");
    return {
      id: String(p.id),
      name: String(p.name),
      activeReleaseId: (p.active_release_id as string) ?? null,
      releaseCount: Number(p.release_count),
    };
  }
  async getActiveState(): Promise<PublishedState> {
    const p = await this.getProject();
    if (!p.activeReleaseId) return { releaseId: null, version: 0, records: {} };
    const state = await this.getReleaseState(p.activeReleaseId);
    if (!state) throw new Error("Active release missing.");
    return state;
  }
  async getReleaseState(id: string): Promise<PublishedState | null> {
    const r = await this.getRelease(id);
    if (!r) return null;
    const rows = this.query<Record<string, unknown>[]>(
      `select coalesce(json_agg(r),'[]'::json) from public.release_records r where project_id=${literal(this.projectId)}::uuid and release_id=${literal(id)}::uuid`,
    );
    const records = rows.map((r): RecordState => ({
      id: String(r.record_id),
      type: r.record_type as RecordState["type"],
      lifecycle: r.lifecycle as RecordState["lifecycle"],
      record: (r.data as RecordState["record"]) ?? null,
      tombstone: (r.tombstone as RecordState["tombstone"]) ?? null,
      contentHash: (r.content_hash as string) ?? null,
      introducedIn: String(r.introduced_in),
      changedIn: String(r.changed_in),
    }));
    return {
      releaseId: id,
      version: r.version,
      records: Object.fromEntries(records.map((r) => [r.id, r])),
    };
  }
  async getRelease(id: string) {
    const r = this.query<Record<string, unknown> | null>(
      `select (select row_to_json(r) from public.releases r where project_id=${literal(this.projectId)}::uuid and id=${literal(id)}::uuid)`,
    );
    return r ? release(r) : null;
  }
  async listReleases() {
    return this.query<Record<string, unknown>[]>(
      `select coalesce(json_agg(r order by version desc),'[]'::json) from public.releases r where project_id=${literal(this.projectId)}::uuid`,
    ).map(release);
  }
  async commitRelease(
    r: NewRelease,
    records: RecordState[],
  ): Promise<CommitResult> {
    return this.query<CommitResult>(
      `select public.tide_commit_release(${literal(this.projectId)}::uuid,${json(r)},${json(records)})`,
    );
  }
  async recordPublicationEvent(e: Omit<PublicationEvent, "id" | "at">) {
    if (e.outcome === "applied") return;
    this.query(
      `select to_json(public.tide_record_publication_event(${literal(this.projectId)}::uuid,${e.releaseId ? literal(e.releaseId) + "::uuid" : "null"},${literal(e.outcome)},${e.code ? literal(e.code) : "null"},${json(e.counts)}))`,
    );
  }
  async listPublicationEvents(limit: number) {
    const rows = this.query<Record<string, unknown>[]>(
      `select coalesce(json_agg(e),'[]'::json) from (select * from public.publication_events where project_id=${literal(this.projectId)}::uuid order by at desc limit ${Math.max(0, Math.min(200, Math.floor(limit)))}) e`,
    );
    return rows.map((r): PublicationEvent => ({
      id: String(r.id),
      at: String(r.at),
      releaseId: (r.release_id as string) ?? null,
      outcome: r.outcome as PublicationEvent["outcome"],
      code: (r.code as string) ?? null,
      actor: r.actor as PublicationEvent["actor"],
      counts: r.counts as PublicationEvent["counts"],
    }));
  }
}
