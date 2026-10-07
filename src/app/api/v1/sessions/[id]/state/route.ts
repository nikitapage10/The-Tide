/** PATCH /api/v1/sessions/:id/state — live session status and dates (live-owned only). */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { ctx, body } = await gmMutation(req);
  const state = await ctx.operations.updateSessionState((await params).id, body, ctx.actor);
  return json({ state });
});
