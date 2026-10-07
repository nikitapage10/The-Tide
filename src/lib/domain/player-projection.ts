/**
 * DESIGN FOR LATER — not exposed by any route in the MVP.
 *
 * A future player view must be produced server-side from an explicit
 * allowlist. Marking a record "player_safe" makes it *eligible*; it never
 * makes it public by itself (a future sharing feature must also be enabled
 * and authorized). Excluded: GM notes, session prep, source references,
 * conflicts, hidden relationships, private assets, demo records and anything
 * archived or tombstoned.
 */
import type { PublishedState } from "./types";

export interface PlayerRecord {
  id: string;
  type: "entity" | "story" | "session" | "media";
  title: string;
  summary: string | null;
  body: string | null;
  tags: string[];
  kind?: string;
  url?: string;
}

export interface PlayerRelation {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  inverseLabel: string | null;
}

export function projectForPlayers(state: PublishedState): { records: PlayerRecord[]; relations: PlayerRelation[] } {
  const eligible = new Set<string>();
  const records: PlayerRecord[] = [];
  for (const rs of Object.values(state.records)) {
    const r = rs.record;
    if (!r || rs.lifecycle !== "active" || r.demo || r.visibility !== "player_safe") continue;
    switch (r.type) {
      case "entity":
        records.push({ id: r.id, type: "entity", title: r.title, summary: r.summary ?? null, body: r.body ?? null, tags: r.tags ?? [], kind: r.kind });
        break;
      case "story":
        records.push({ id: r.id, type: "story", title: r.title, summary: r.summary ?? null, body: null, tags: r.tags ?? [] });
        break;
      case "session":
        // Prep is GM material; only the recap may be shared.
        records.push({ id: r.id, type: "session", title: r.title, summary: r.summary ?? null, body: r.recap ?? null, tags: [] });
        break;
      case "media":
        // Private assets are never projected; only public external links.
        if (!r.url || r.asset) continue;
        records.push({ id: r.id, type: "media", title: r.title, summary: r.summary ?? null, body: null, tags: r.tags ?? [], url: r.url });
        break;
      default:
        continue;
    }
    eligible.add(r.id);
  }
  const relations: PlayerRelation[] = [];
  for (const rs of Object.values(state.records)) {
    const r = rs.record;
    if (!r || r.type !== "relationship" || rs.lifecycle !== "active" || r.demo || r.visibility !== "player_safe") continue;
    if (!eligible.has(r.fromId) || !eligible.has(r.toId)) continue;
    relations.push({ id: r.id, fromId: r.fromId, toId: r.toId, label: r.label, inverseLabel: r.inverseLabel ?? null });
  }
  return { records, relations };
}
