/**
 * URL and content safety rules for untrusted imported content.
 * Shared by the validator (reject on import) and the renderer (defense in depth).
 * The server never fetches supplied URLs.
 */
import { LIMITS } from "./schema";

export const SAFE_LINK_PROTOCOLS = ["https:", "http:", "mailto:"] as const;
export const SAFE_RESOURCE_PROTOCOLS = ["https:", "http:"] as const;

export type UrlCheck = { ok: true; warning?: string } | { ok: false; reason: string };

export function checkExternalUrl(raw: string, allowed: readonly string[] = SAFE_RESOURCE_PROTOCOLS): UrlCheck {
  if (raw.length > LIMITS.maxUrl) return { ok: false, reason: "URL is too long" };
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return { ok: false, reason: "URL contains whitespace or control characters" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not an absolute URL" };
  }
  if (!allowed.includes(url.protocol)) {
    return { ok: false, reason: `protocol "${url.protocol}" is not allowed (use ${allowed.join(" or ")})` };
  }
  if (url.username || url.password) return { ok: false, reason: "URLs must not embed credentials" };
  if ((url.protocol === "https:" || url.protocol === "http:") && !url.hostname) {
    return { ok: false, reason: "URL has no host" };
  }
  if (url.protocol === "http:") return { ok: true, warning: "insecure http:// link; prefer https://" };
  return { ok: true };
}

/** Used by the Markdown renderer: returns a safe href or null (link rendered as text). */
export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("#")) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  const check = checkExternalUrl(trimmed, SAFE_LINK_PROTOCOLS);
  return check.ok ? trimmed : null;
}

const DANGEROUS_TAG = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|form|base|svg|math|frame|frameset|template)\b/i;
const EVENT_HANDLER_ATTR = /<[^>]*\son[a-z]+\s*=/i;
const ANY_TAG = /<\s*\/?\s*[a-z][a-z0-9-]*(\s[^>]*)?>/i;
const LINK_DESTINATION = /\]\(\s*<?\s*([^)\s>]+)/g;
const AUTOLINK = /<([a-z][a-z0-9+.-]{1,31}:[^>\s]*)>/gi;
const HTML_URL_ATTR = /\b(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*([^"'\s>]+)/gi;

export interface ContentIssue {
  severity: "error" | "warning";
  message: string;
}

/** Checks one Markdown field. Errors reject the bundle; warnings appear in the preview. */
export function checkMarkdown(text: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (DANGEROUS_TAG.test(text)) {
    issues.push({ severity: "error", message: "contains a disallowed HTML element (script, iframe, style, form, svg, …)" });
  }
  if (EVENT_HANDLER_ATTR.test(text)) {
    issues.push({ severity: "error", message: "contains an HTML event-handler attribute (on…=)" });
  }
  const destinations = [
    ...[...text.matchAll(LINK_DESTINATION)].map((m) => m[1] ?? ""),
    ...[...text.matchAll(AUTOLINK)].map((m) => m[1] ?? ""),
    ...[...text.matchAll(HTML_URL_ATTR)].map((m) => m[1] ?? ""),
  ];
  for (const dest of destinations) {
    if (!dest || dest.startsWith("#") || (dest.startsWith("/") && !dest.startsWith("//"))) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith("//")) {
      const check = checkExternalUrl(dest, SAFE_LINK_PROTOCOLS);
      if (!check.ok) issues.push({ severity: "error", message: `unsafe link "${truncate(dest)}": ${check.reason}` });
    }
  }
  if (!issues.some((i) => i.severity === "error") && ANY_TAG.test(text)) {
    issues.push({ severity: "warning", message: "raw HTML is not rendered; it will be ignored. Use Markdown instead." });
  }
  return issues;
}

function truncate(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}
