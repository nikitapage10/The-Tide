/** PATCH /api/v1/builds/:id — revision-checked edit. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { ctx, body } = await gmMutation(req);
  return json({ build: await ctx.operations.updateBuild((await params).id, body, ctx.actor) });
});
