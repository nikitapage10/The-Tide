/** POST /api/v1/checklist-items — add an operational prep item to a session or story. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx, body } = await gmMutation(req);
  return json({ item: await ctx.operations.createChecklistItem(body, ctx.actor) }, 201);
});
