/** POST /api/v1/publications/publish — validate and apply a bundle atomically. Idempotent per releaseId. */
import { publisherRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx, text } = await publisherRequest(req);
  const result = await ctx.publication.publish(text, ctx.actor);
  return json({ status: result.status, release: result.release, preview: result.preview }, result.status === "applied" ? 201 : 200);
});
