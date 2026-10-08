/** GET /api/v1/openapi.json — the publisher's OpenAPI document (for a ChatGPT custom GPT Action). Public: it holds no secrets. */
import { publisherOpenApi } from "@/lib/contract/openapi";
import { route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const origin = host ? `${proto}://${host}` : new URL(req.url).origin;
  return new Response(JSON.stringify(publisherOpenApi(origin), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
});
