import "server-only";
/**
 * Publishes the lore from the GM's documents (fixtures/publication/
 * lore-release.json, built by scripts/build-lore-bundle.ts) to a live site
 * that does not have it yet, with no one pressing anything. It runs through
 * the normal publication service (validated, versioned, in the release
 * history, and can be rolled back), as the machine publisher when the server
 * key is set, otherwise as the GM on their next visit.
 *
 * Idempotent: it only acts while one of the lore's records is missing, and
 * the release ID is derived from the base release, so a retry replays. A
 * record the GM later archives stays archived (archived still counts as
 * present). Turn it off with TIDE_AUTO_LORE=off.
 */
import loreRelease from "@fixtures/publication/lore-release.json";
import { uuidV5 } from "@/lib/contract/ids";
import type { PublishedState } from "@/lib/domain/types";
import type { AppContext } from "./context";

type Op = { op: string; record?: { id: string; type: string } };
const ENTITY_IDS = (loreRelease.operations as Op[]).filter((o) => o.record?.type === "entity").map((o) => o.record!.id);

/** True when some of the lore has never been published here. */
export function loreMissing(state: PublishedState): boolean {
  return ENTITY_IDS.some((id) => !state.records[id]);
}

/**
 * The lore release, prepared against the active state: based on its release,
 * and without archive steps for records this site never had.
 */
export function loreBundleFor(state: PublishedState) {
  const operations = (loreRelease.operations as (Op & { targetId?: string })[]).filter((o) => o.op !== "archive" || (o.targetId && state.records[o.targetId]));
  return { ...loreRelease, operations, baseReleaseId: state.releaseId, releaseId: uuidV5(loreRelease.projectId, `lore-release:${state.releaseId ?? "first"}`) };
}

let running: Promise<void> | null = null;
let done = false;
/** For tests. */
export function resetAutoLore() {
  done = false;
  running = null;
}

/** Applies the lore if it is missing. Never throws: a failure is logged and retried on a later request. */
export function ensureLore(ctx: AppContext): Promise<void> {
  if (done || process.env.TIDE_AUTO_LORE === "off" || ctx.mode !== "supabase" || ctx.projectId !== loreRelease.projectId) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    try {
      const writer = await writerFor(ctx);
      if (!writer) return;
      const state = await writer.publicationStore.getActiveState();
      if (!loreMissing(state)) {
        done = true;
        return;
      }
      const result = await writer.publication.publish(loreBundleFor(state), writer.actor);
      if (result.status === "applied" || result.status === "replayed") {
        done = true;
        console.info(`[lore] published the lore from the GM's documents as release v${result.release?.version ?? "?"}`);
      } else {
        console.warn("[lore] the lore release was not applied:", result.status);
      }
    } catch (e) {
      console.warn("[lore] could not publish the lore release yet:", e instanceof Error ? e.message : typeof e);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** The machine publisher (server key) if configured, else the GM's own context, else nobody. */
async function writerFor(ctx: AppContext): Promise<AppContext | null> {
  const { resolveMode } = await import("./config");
  const info = resolveMode();
  if (info.mode === "supabase") {
    const { createServiceClient } = await import("./supabase");
    const db = createServiceClient(info.supabaseUrl);
    if (db) {
      const { SupabaseStore } = await import("@/lib/data/supabase-store");
      const { wireContext } = await import("./context");
      const { MACHINE_ACTOR } = await import("./publisher-auth");
      return wireContext("supabase", info.projectId, MACHINE_ACTOR, new SupabaseStore(db, info.projectId));
    }
  }
  return ctx.canEdit ? ctx : null;
}
