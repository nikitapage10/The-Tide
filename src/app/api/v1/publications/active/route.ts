/**
 * GET /api/v1/publications/active — the active release (needed as a bundle's
 * baseReleaseId). Machine publisher (bearer) or GM.
 */
import { readerRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const ctx = await readerRequest(req);
  const state = await ctx.publicationStore.getActiveState();
  return json({ projectId: ctx.projectId, activeReleaseId: state.releaseId, version: state.version });
});
