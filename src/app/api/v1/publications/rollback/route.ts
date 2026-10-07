/** POST /api/v1/publications/rollback — GM only. Creates a new release restoring an earlier snapshot. */
import { z } from "zod";
import { zId } from "@/lib/contract/schema";
import { parseInput } from "@/lib/domain/operations";
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

const zRollback = z.strictObject({ releaseId: zId, targetReleaseId: zId, expectedActiveReleaseId: zId.nullable() });

export const POST = route(async (req) => {
  const { ctx, body } = await gmMutation(req);
  const input = parseInput(zRollback, body);
  const result = await ctx.publication.rollback(input, ctx.actor);
  return json({ status: result.status, release: result.release, preview: result.preview }, result.status === "applied" ? 201 : 200);
});
