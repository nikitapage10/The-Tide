/** POST /api/v1/builds/:id/versions — record a version entry. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { ctx, body } = await gmMutation(req);
  return json({ build: await ctx.operations.addBuildVersion((await params).id, body, ctx.actor) }, 201);
});
