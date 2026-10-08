/**
 * Pure read helpers over a published snapshot. Shared by every adapter.
 */
import type {
  EntityRecord,
  MediaRecord,
  OpenQuestionRecord,
  PublishedRecord,
  RecordType,
  RelationshipRecord,
  SessionRecord,
  SourceRecord,
  StoryPartRecord,
  StoryRecord,
} from "@/lib/contract/schema";
import { recordTitle } from "./publication";
import { sectionForEntityKind } from "./sections";
import type { PublishedState, RecordState } from "./types";

type ByType = {
  entity: EntityRecord;
  story: StoryRecord;
  story_part: StoryPartRecord;
  session: SessionRecord;
  relationship: RelationshipRecord;
  media: MediaRecord;
  source: SourceRecord;
  open_question: OpenQuestionRecord;
};

export interface Listed<T extends PublishedRecord> {
  record: T;
  state: RecordState;
}

export function listRecords<K extends RecordType>(
  state: PublishedState,
  type: K,
  opts: { includeArchived?: boolean } = {},
): Listed<ByType[K]>[] {
  return Object.values(state.records)
    .filter((rs) => rs.type === type && rs.record && (rs.lifecycle === "active" || (opts.includeArchived && rs.lifecycle === "archived")))
    .map((rs) => ({ record: rs.record as ByType[K], state: rs }))
    .sort((a, b) => sortTitle(a.record).localeCompare(sortTitle(b.record), undefined, { sensitivity: "base" }));
}

function sortTitle(r: PublishedRecord) {
  return recordTitle(r);
}

/** How a reference to a stable ID should be displayed, including archived/tombstoned/unknown. */
export interface ResolvedRef {
  id: string;
  title: string;
  type: RecordType | null;
  status: "active" | "archived" | "tombstoned" | "missing";
  href: string | null;
  demo: boolean;
}

export function hrefFor(rs: RecordState | undefined): string | null {
  if (!rs || !rs.record) return null;
  const r = rs.record;
  switch (r.type) {
    case "entity":
      return `/${sectionForEntityKind(r.kind) === "people" ? "people" : "world"}/entry/${r.id}`;
    case "story":
      return `/stories/${r.id}`;
    case "story_part":
      return `/stories/${r.storyId}#part-${r.id}`;
    case "session":
      return `/stories/sessions/${r.id}`;
    case "media":
      return `/studio/item/${r.id}`;
    case "open_question":
      return `/workshop#open-questions`;
    case "source":
      return `/workshop/sources#source-${r.id}`;
    default:
      return null;
  }
}

export function resolveRef(state: PublishedState, id: string): ResolvedRef {
  const rs = state.records[id];
  if (!rs) return { id, title: "Unknown record", type: null, status: "missing", href: null, demo: false };
  if (rs.lifecycle === "tombstoned" || !rs.record) {
    return { id, title: rs.tombstone?.lastTitle ?? "Removed record", type: rs.type, status: "tombstoned", href: null, demo: false };
  }
  return { id, title: recordTitle(rs.record), type: rs.type, status: rs.lifecycle, href: hrefFor(rs), demo: rs.record.demo };
}

export interface RelationView {
  relationshipId: string;
  label: string;
  direction: "outgoing" | "incoming";
  other: ResolvedRef;
  note: string | null;
  demo: boolean;
  canonStatus: RelationshipRecord["canonStatus"];
}

/** Relationships touching a record, in both directions (incoming use inverseLabel when supplied). */
export function relationsFor(state: PublishedState, id: string): RelationView[] {
  const out: RelationView[] = [];
  for (const { record: rel } of listRecords(state, "relationship")) {
    if (rel.fromId === id) {
      out.push({ relationshipId: rel.id, label: rel.label, direction: "outgoing", other: resolveRef(state, rel.toId), note: rel.note ?? null, demo: rel.demo, canonStatus: rel.canonStatus });
    } else if (rel.toId === id) {
      out.push({ relationshipId: rel.id, label: rel.inverseLabel ?? rel.label, direction: "incoming", other: resolveRef(state, rel.fromId), note: rel.note ?? null, demo: rel.demo, canonStatus: rel.canonStatus });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label) || a.other.title.localeCompare(b.other.title));
}

/** Records whose relatedIds/linkedIds/viewpointIds mention this id ("mentioned in"). */
export function backlinksFor(state: PublishedState, id: string): ResolvedRef[] {
  const refs: ResolvedRef[] = [];
  for (const rs of Object.values(state.records)) {
    const r = rs.record;
    if (!r || rs.lifecycle !== "active" || r.id === id) continue;
    const lists: (readonly string[] | undefined)[] = [];
    if ("relatedIds" in r) lists.push(r.relatedIds);
    if ("viewpointIds" in r) lists.push(r.viewpointIds);
    if (r.type === "media") lists.push(r.linkedIds);
    if (r.type === "entity") lists.push(r.parentId ? [r.parentId] : []);
    if (lists.some((l) => l?.includes(id))) refs.push(resolveRef(state, r.id));
  }
  return refs.sort((a, b) => a.title.localeCompare(b.title));
}

export function mediaFor(state: PublishedState, id: string): Listed<MediaRecord>[] {
  const rs = state.records[id];
  const explicit = rs?.record?.type === "entity" ? (rs.record.mediaIds ?? []) : [];
  return listRecords(state, "media").filter((m) => m.record.linkedIds?.includes(id) || explicit.includes(m.record.id));
}

export function sessionsForStory(state: PublishedState, storyId: string): Listed<SessionRecord>[] {
  return listRecords(state, "session", { includeArchived: true })
    .filter((s) => s.record.storyId === storyId)
    .sort((a, b) => (a.record.sequence ?? Infinity) - (b.record.sequence ?? Infinity));
}

export function partsForStory(state: PublishedState, storyId: string): Listed<StoryPartRecord>[] {
  return listRecords(state, "story_part", { includeArchived: true })
    .filter((s) => s.record.storyId === storyId)
    .sort((a, b) => (a.record.sequence ?? Infinity) - (b.record.sequence ?? Infinity));
}

export function childrenOf(state: PublishedState, id: string): Listed<EntityRecord>[] {
  return listRecords(state, "entity").filter((e) => e.record.parentId === id);
}

export function allTags(records: { record: { tags?: string[] } }[]): string[] {
  return [...new Set(records.flatMap((r) => r.record.tags ?? []))].sort((a, b) => a.localeCompare(b));
}
