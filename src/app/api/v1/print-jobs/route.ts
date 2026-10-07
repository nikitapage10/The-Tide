/** POST /api/v1/print-jobs — create a print job. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx, body } = await gmMutation(req);
  return json({ job: await ctx.operations.createPrintJob(body, ctx.actor) }, 201);
});
