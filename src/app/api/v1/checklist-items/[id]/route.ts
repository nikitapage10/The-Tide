/** PATCH/DELETE /api/v1/checklist-items/:id — revision-checked update or removal. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req, { params }: P) => {
  const { ctx, body } = await gmMutation(req);
  return json({ item: await ctx.operations.updateChecklistItem((await params).id, body, ctx.actor) });
});

export const DELETE = route(async (req, { params }: P) => {
  const { ctx, body } = await gmMutation(req);
  await ctx.operations.deleteChecklistItem((await params).id, body, ctx.actor);
  return json({ deleted: true });
});
