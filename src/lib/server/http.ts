import "server-only";
/**
 * HTTP helpers for app-owned API routes: JSON-only bodies with size limits,
 * same-origin (CSRF) checks for cookie-authenticated mutations, uniform
 * error envelopes and no-store caching.
 */
import { DomainError, isDomainError } from "@/lib/domain/errors";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "Content-Type": "application/json; charset=utf-8" };

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: NO_STORE });
}

export function errorResponse(e: unknown): Response {
  if (isDomainError(e)) {
    return json({ error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } }, e.status);
  }
  // Never echo unknown errors (may contain request content); log a short marker only.
  console.error("[api] unexpected error", e instanceof Error ? e.name : typeof e);
  return json({ error: { code: "INTERNAL", message: "Unexpected server error." } }, 500);
}

/**
 * CSRF defence for cookie-authenticated requests: the browser-supplied Origin
 * must match this app's origin (or an explicitly allowed origin), and the
 * body must be application/json (which forces a CORS preflight cross-site).
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new DomainError("CSRF_REJECTED", "Cross-site request rejected.");
  if (!origin) throw new DomainError("CSRF_REJECTED", "Missing Origin header.");
  const allowed = new Set<string>([new URL(req.url).origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  (process.env.TIDE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => allowed.add(o));
  if (!allowed.has(origin)) throw new DomainError("CSRF_REJECTED", "Origin not allowed.");
}

export async function readJson(req: Request, maxBytes: number): Promise<{ value: unknown; text: string }> {
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) throw new DomainError("UNSUPPORTED_MEDIA_TYPE", "Send Content-Type: application/json.");
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new DomainError("PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new DomainError("PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
  try {
    return { value: JSON.parse(text), text };
  } catch {
    throw new DomainError("INVALID_JSON", "Request body is not valid JSON.");
  }
}

export function route<A extends unknown[]>(handler: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    try {
      return await handler(req, ...rest);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export const MAX_LIVE_BODY = 64 * 1024;
