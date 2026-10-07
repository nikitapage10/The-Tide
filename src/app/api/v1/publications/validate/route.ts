/** POST /api/v1/publications/validate — validate + preview a bundle. Never writes. */
import { publisherRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx, text } = await publisherRequest(req);
  const preview = await ctx.publication.preview(text);
  return json({ preview });
});
