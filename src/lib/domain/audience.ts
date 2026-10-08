/**
 * Three audiences, in layers: the GM sees everything; players see what is
 * marked player_safe or public; the public sees only what is marked public.
 *
 * Applied server-side to the published state before any page reads it, so a
 * hidden record never reaches a narrower audience's HTML. Material that is
 * always the GM's (session prep, source references, conflicts, sources, open
 * questions, demo records) is stripped for everyone else regardless of tier.
 */
import type { PublishedRecord, Visibility } from "@/lib/contract/schema";
import type { PublishedState, RecordState } from "./types";

export type Audience = "gm" | "player" | "public";

const SEES: Record<Audience, ReadonlySet<Visibility>> = {
  gm: new Set(["gm_only", "player_safe", "public"]),
  player: new Set(["player_safe", "public"]),
  public: new Set(["public"]),
};

export function canSee(audience: Audience, visibility: Visibility | undefined): boolean {
  return SEES[audience].has(visibility ?? "gm_only");
}

/** A copy of the record with GM-only fields removed. */
function scrub(r: PublishedRecord): PublishedRecord {
  const out = { ...r } as PublishedRecord & Record<string, unknown>;
  delete out.sourceRefs;
  delete out.conflicts;
  if (out.type === "session") delete (out as Record<string, unknown>).prep;
  return out;
}

export function filterForAudience(state: PublishedState, audience: Audience): PublishedState {
  if (audience === "gm") return state;
  const visible = new Set<string>();
  for (const rs of Object.values(state.records)) {
    const r = rs.record;
    if (!r || r.demo) continue;
    if (r.type === "source" || r.type === "open_question" || r.type === "relationship") continue;
    if (canSee(audience, r.visibility)) visible.add(r.id);
  }
  const records: Record<string, RecordState> = {};
  for (const [id, rs] of Object.entries(state.records)) {
    const r = rs.record;
    if (!r) continue;
    if (r.type === "relationship") {
      // Shown only when both ends (and the relationship itself) are visible.
      if (r.demo || !canSee(audience, r.visibility) || !visible.has(r.fromId) || !visible.has(r.toId)) continue;
    } else if (!visible.has(id)) continue;
    records[id] = { ...rs, record: scrub(r) };
  }
  return { ...state, records };
}

/**
 * How public visitors are scoped. "all" keeps the project's current open
 * preview (visitors read everything published, as before); "tiered" applies
 * the audience layers. Set with TIDE_PUBLIC_SCOPE.
 */
export function publicScope(env: NodeJS.ProcessEnv = process.env): "all" | "tiered" {
  return env.TIDE_PUBLIC_SCOPE === "tiered" ? "tiered" : "all";
}
