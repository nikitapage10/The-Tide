"use client";
/** JSON fetch helper for app-owned endpoints. Same-origin; cookies carry the session. */
export interface ApiError {
  code: string;
  message: string;
  details?: { fieldErrors?: Record<string, string>; issues?: unknown[]; [k: string]: unknown };
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

export async function api<T>(path: string, method: "POST" | "PATCH" | "DELETE" | "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: json?.error ?? { code: "INTERNAL", message: `Request failed (${res.status}).` } };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: "Network error. Check your connection and try again." } };
  }
}

export function messageFor(error: ApiError): string {
  if (error.code === "REVISION_CONFLICT") return "This was changed elsewhere since you loaded the page. Reload to see the latest version, then try again.";
  if (error.code === "UNAUTHENTICATED") return "Your session has ended. Sign in again.";
  return error.message;
}
