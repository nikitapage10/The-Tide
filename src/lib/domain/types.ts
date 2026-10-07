/**
 * Domain model. Four separate concerns:
 *  1. Identity & membership     — ProjectInfo, Actor, stable record IDs (UUIDs)
 *  2. Published, versioned lore — ReleaseInfo, RecordState, PublishedState (immutable per release)
 *  3. Live operational records  — SessionState, ChecklistItem, GmNote, PrintJob, PrintAttempt, ActivityEvent
 *  4. Sources & assets          — SourceRecord / MediaRecord (published), signed URLs (never stored)
 *
 * Live records reference published records only by stable ID, never by a
 * release-specific row, so publishing/rollback can never orphan or reset them.
 */
import type { PublishedRecord, RecordType } from "@/lib/contract/schema";

export type Lifecycle = "active" | "archived" | "tombstoned";

export interface Tombstone {
  /** Last known title, kept so history and live references remain readable. */
  lastTitle: string;
  reason: string;
  releaseId: string;
}

/** One record as it exists in a specific release snapshot. */
export interface RecordState {
  id: string;
  type: RecordType;
  lifecycle: Lifecycle;
  /** Null only when tombstoned. */
  record: PublishedRecord | null;
  tombstone: Tombstone | null;
  contentHash: string | null;
  /** Release that first introduced this identity. */
  introducedIn: string;
  /** Release that last changed content or lifecycle. */
  changedIn: string;
}

export interface PublishedState {
  releaseId: string | null;
  version: number;
  records: Record<string, RecordState>;
}

export type ActorKind = "user" | "machine" | "demo";
export interface Actor {
  kind: ActorKind;
  id: string;
  label: string;
}

export interface ReleaseCounts {
  added: number;
  changed: number;
  unchanged: number;
  archived: number;
  restored: number;
  tombstoned: number;
  total: number;
}

export interface ReleaseInfo {
  id: string;
  projectId: string;
  /** Server-assigned, strictly increasing. Rollbacks get a new, higher version. */
  version: number;
  kind: "publish" | "rollback";
  baseReleaseId: string | null;
  rollbackOfReleaseId: string | null;
  bundleHash: string;
  schemaVersion: string;
  /** Supplied by the bundle author (or the server for rollbacks). */
  createdAt: string;
  /** Server-assigned. */
  publishedAt: string;
  publishedBy: Actor;
  title: string | null;
  notes: string | null;
  counts: ReleaseCounts;
}

export interface ProjectInfo {
  id: string;
  name: string;
  activeReleaseId: string | null;
  releaseCount: number;
}

export type PublicationOutcome = "applied" | "replayed" | "rejected";
export interface PublicationEvent {
  id: string;
  at: string;
  releaseId: string | null;
  outcome: PublicationOutcome;
  code: string | null;
  actor: Actor;
  /** Counts only; never source text, tokens or private URLs. */
  counts: ReleaseCounts | null;
}

// ---------------------------------------------------------------- live records

export const SESSION_STATUSES = ["planned", "scheduled", "in_progress", "completed", "postponed", "canceled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface SessionState {
  sessionId: string;
  projectId: string;
  status: SessionStatus;
  /** ISO date (YYYY-MM-DD) or null. Operational, not canon. */
  scheduledFor: string | null;
  actualRunDate: string | null;
  revision: number;
  demo: boolean;
  updatedAt: string | null;
}

export interface ChecklistItem {
  id: string;
  projectId: string;
  /** Stable ID of a session or story. */
  subjectId: string;
  label: string;
  done: boolean;
  sortOrder: number;
  revision: number;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GmNote {
  id: string;
  projectId: string;
  subjectId: string;
  body: string;
  demo: boolean;
  createdAt: string;
  authorLabel: string;
}

export const PRINT_STATUSES = [
  "planned",
  "ready",
  "printing",
  "post_processing",
  "complete",
  "blocked",
  "canceled",
] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];
export const PRINT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type PrintPriority = (typeof PRINT_PRIORITIES)[number];
export const LENGTH_UNITS = ["mm", "cm", "in"] as const;

export interface PrintDimensions {
  x: number | null;
  y: number | null;
  z: number | null;
  unit: (typeof LENGTH_UNITS)[number];
}

export interface PrintJob {
  id: string;
  projectId: string;
  title: string;
  sourceUrl: string | null;
  fileReference: string | null;
  fileFormat: string | null;
  printerProfile: string | null;
  material: string | null;
  scale: string | null;
  dimensions: PrintDimensions | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  requestedQuantity: number;
  completedQuantity: number;
  /** Tally of failed pieces recorded through attempts; never changes requestedQuantity. */
  failedQuantity: number;
  status: PrintStatus;
  priority: PrintPriority;
  notes: string | null;
  linkedRecordIds: string[];
  revision: number;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrintAttempt {
  id: string;
  printJobId: string;
  outcome: "succeeded" | "failed";
  quantity: number;
  note: string | null;
  recordedAt: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  at: string;
  kind: string;
  /** Short, non-sensitive summary (never contains note bodies or private URLs). */
  summary: string;
  subjectId: string | null;
  actorLabel: string;
  demo: boolean;
}

// ------------------------------------------------- Workshop build records (live)

export const BUILD_CATEGORIES = ["physical", "code", "logic", "dashboard", "other"] as const;
export type BuildCategory = (typeof BUILD_CATEGORIES)[number];
export const BUILD_STATUSES = ["idea", "planned", "in_progress", "paused", "done", "abandoned"] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export interface BuildLink {
  label: string;
  url: string;
}

export interface BuildVersion {
  id: string;
  label: string;
  note: string | null;
  url: string | null;
  recordedAt: string;
}

/**
 * A practical Workshop record for physical creations, code, logic or dashboard work.
 * Live-owned: created and edited in the dashboard, never written by the publisher.
 */
export interface BuildRecord {
  id: string;
  projectId: string;
  title: string;
  category: BuildCategory;
  purpose: string | null;
  status: BuildStatus;
  links: BuildLink[];
  versions: BuildVersion[];
  notes: string | null;
  linkedRecordIds: string[];
  revision: number;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}
