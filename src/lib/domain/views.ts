/**
 * View models for the section pages: what the atlas, the gallery, the
 * library and the light table need from a published snapshot. Pure and
 * shared, like queries.ts.
 */
import type { EntityKind, EntityRecord, Era, MediaRecord } from "@/lib/contract/schema";
import { childrenOf, listRecords, mediaFor, type Listed } from "./queries";
import type { PublishedState } from "./types";

/** An entry's image for a role (a linked media record with that role, else any linked image). */
export function imageFor(state: PublishedState, id: string, role: MediaRecord["role"] = "portrait"): string | null {
  const media = mediaFor(state, id).map((m) => m.record);
  const pick = media.find((m) => m.role === role && m.url) ?? media.find((m) => m.mediaType === "artwork" && m.url);
  return pick?.url && isImageUrl(pick.url) ? pick.url : null;
}

/** Only images we can show without fetching anything new: files shipped with the site. */
export function isImageUrl(url: string): boolean {
  return /^\/(?!\/)[^?#]*\.(webp|png|jpe?g|avif|gif)$/i.test(url);
}

export const isEnclave = (e: EntityRecord) => e.kind === "people" && (e.tags ?? []).includes("enclave");

export function peoples(state: PublishedState): Listed<EntityRecord>[] {
  return listRecords(state, "entity").filter((e) => e.record.kind === "people" && !isEnclave(e.record));
}

export function enclaves(state: PublishedState): Listed<EntityRecord>[] {
  return listRecords(state, "entity").filter((e) => isEnclave(e.record));
}

export function ofKinds(state: PublishedState, kinds: EntityKind[]): Listed<EntityRecord>[] {
  return listRecords(state, "entity").filter((e) => kinds.includes(e.record.kind));
}

/** Factions and institutions belonging to a people (nested under it, or related "Faction of"). */
export function factionsOf(state: PublishedState, peopleId: string): Listed<EntityRecord>[] {
  const nested = childrenOf(state, peopleId).filter((c) => c.record.kind === "faction" || c.record.kind === "institution");
  const related = listRecords(state, "relationship")
    .filter((r) => r.record.toId === peopleId && /faction of|member of/i.test(r.record.label))
    .map((r) => state.records[r.record.fromId])
    .filter((rs) => rs?.record?.type === "entity" && rs.lifecycle === "active")
    .map((rs) => ({ record: rs!.record as EntityRecord, state: rs! }));
  const seen = new Set<string>();
  return [...nested, ...related].filter((f) => (seen.has(f.record.id) ? false : (seen.add(f.record.id), true)));
}

/** Everything nested under an entry, by kind, except factions (shown on their own). */
export function belongings(state: PublishedState, id: string): Listed<EntityRecord>[] {
  return childrenOf(state, id).filter((c) => c.record.kind !== "faction" && c.record.kind !== "institution");
}

export interface TimelineEntry {
  id: string;
  title: string;
  summary: string | null;
  kind: EntityKind;
  era: Era | null;
  label: string | null;
  sortKey: number;
  certainty: string;
  canon: EntityRecord["canonStatus"];
  people: string | null;
}

/** The world's events and ages in order (only those the sources place). */
export function timeline(state: PublishedState): TimelineEntry[] {
  const peopleTitle = (id: string | null | undefined) => {
    const r = id ? state.records[id]?.record : null;
    return r?.type === "entity" && r.kind === "people" ? r.title : null;
  };
  return listRecords(state, "entity")
    .filter((e) => typeof e.record.chronology?.sortKey === "number")
    .map(({ record: r }) => ({
      id: r.id,
      title: r.title,
      summary: r.summary ?? null,
      kind: r.kind,
      era: r.era ?? null,
      label: r.chronology?.label ?? null,
      sortKey: r.chronology!.sortKey!,
      certainty: r.chronology!.certainty,
      canon: r.canonStatus,
      people: peopleTitle(r.parentId),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

/** Places on the atlas (with a location) and those not yet charted. */
export function places(state: PublishedState) {
  // The world itself is the globe, not a place on it.
  const all = ofKinds(state, ["place", "environment"]).filter((p) => !(p.record.tags ?? []).includes("the world"));
  return {
    charted: all.filter((p) => p.record.location),
    uncharted: all.filter((p) => !p.record.location),
  };
}

/** The Three Consequences, in order, when published (matched by title). */
export function consequences(state: PublishedState) {
  const find = (re: RegExp) => listRecords(state, "entity").find((e) => re.test(e.record.title) && e.record.kind !== "people");
  return [
    { kind: "drowning" as const, entry: find(/^(the )?drowning$/i) },
    { kind: "divergence" as const, entry: find(/^(the )?divergence$/i) },
    { kind: "drift" as const, entry: find(/^(the )?drift$/i) },
  ];
}
