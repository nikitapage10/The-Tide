/** POST /api/v1/gm-notes — append a private GM working note. Never becomes canon. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx, body } = await gmMutation(req);
  const note = await ctx.operations.addGmNote(body, ctx.actor);
  return json({ note: { id: note.id, createdAt: note.createdAt } }, 201);
});
