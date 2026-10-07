/** POST /api/v1/print-jobs/:id/attempts — record succeeded/failed pieces (retries and reprints). */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { ctx, body } = await gmMutation(req);
  return json({ job: await ctx.operations.recordPrintAttempt((await params).id, body, ctx.actor) }, 201);
});
