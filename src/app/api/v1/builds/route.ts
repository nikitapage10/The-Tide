/** POST /api/v1/builds — create a Workshop build record. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx, body } = await gmMutation(req);
  return json({ build: await ctx.operations.createBuild(body, ctx.actor) }, 201);
});
