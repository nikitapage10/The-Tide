/** PATCH /api/v1/print-jobs/:id — revision-checked edit. */
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { ctx, body } = await gmMutation(req);
  return json({ job: await ctx.operations.updatePrintJob((await params).id, body, ctx.actor) });
});
