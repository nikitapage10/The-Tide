/**
 * GET /api/v1/records/index — every record's identity and title in the active
 * release (no bodies), so the publisher can update existing records instead
 * of creating duplicates. Machine publisher (bearer) or GM.
 */
import { readerRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const ctx = await readerRequest(req);
  const state = await ctx.publicationStore.getActiveState();
  const records = Object.values(state.records).map((rs) => {
    const r = rs.record;
    if (!r) return { id: rs.id, type: rs.type, lifecycle: rs.lifecycle, title: rs.tombstone?.lastTitle ?? null };
    const base = { id: r.id, type: r.type, lifecycle: rs.lifecycle, title: "title" in r ? r.title : null, demo: r.demo, visibility: r.visibility };
    switch (r.type) {
      case "entity":
        return { ...base, slug: r.slug ?? null, kind: r.kind, aliases: r.aliases ?? [], parentId: r.parentId ?? null };
      case "story":
        return { ...base, slug: r.slug ?? null, format: r.format };
      case "story_part":
        return { ...base, slug: r.slug ?? null, storyId: r.storyId, sequence: r.sequence ?? null };
      case "session":
        return { ...base, slug: r.slug ?? null, storyId: r.storyId, sequence: r.sequence ?? null };
      case "media":
        return { ...base, slug: r.slug ?? null, mediaType: r.mediaType, role: r.role ?? null };
      case "relationship":
        return { ...base, title: r.label, fromId: r.fromId, toId: r.toId };
      default:
        return base;
    }
  });
  return json({ projectId: ctx.projectId, activeReleaseId: state.releaseId, records });
});
