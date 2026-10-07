import "server-only";
/**
 * Machine-publisher authentication adapter (for the future ChatGPT-managed
 * publisher). Deliberately small and swappable.
 *
 * Current scheme: `Authorization: Bearer <token>`, compared in constant time
 * against TIDE_PUBLISHER_TOKEN_SHA256 (hex SHA-256 of the token). Only the
 * hash is configured on the server; the raw token never lives in the repo.
 * Unconfigured → every bearer request is rejected. There is no unauthenticated path.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/domain/errors";
import type { Actor } from "@/lib/domain/types";
import { resolveMode } from "./config";
import { wireContext, type AppContext } from "./context";

export const MACHINE_ACTOR: Actor = { kind: "machine", id: "machine-publisher", label: "Machine publisher" };

export function hasBearer(req: Request): boolean {
  return /^Bearer\s+/i.test(req.headers.get("authorization") ?? "");
}

export function verifyPublisherToken(header: string | null, expectedSha256Hex: string | undefined): boolean {
  if (!expectedSha256Hex || !/^[0-9a-f]{64}$/i.test(expectedSha256Hex)) return false;
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token || token.length < 32) return false;
  const actual = createHash("sha256").update(token, "utf8").digest();
  const expected = Buffer.from(expectedSha256Hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function requireMachinePublisherContext(req: Request): Promise<AppContext> {
  const info = resolveMode();
  if (info.mode === "setup-required") throw new DomainError("SETUP_REQUIRED", "The dashboard is not configured.");
  if (!verifyPublisherToken(req.headers.get("authorization"), process.env.TIDE_PUBLISHER_TOKEN_SHA256)) {
    throw new DomainError("UNAUTHENTICATED", "Invalid or unconfigured publisher credentials.");
  }
  if (info.mode === "demo") {
    const { getDemoFileStore } = await import("@/lib/data/demo-file-store");
    return wireContext("demo", info.projectId, MACHINE_ACTOR, await getDemoFileStore());
  }
  const { createServiceClient } = await import("./supabase");
  const { SupabaseStore } = await import("@/lib/data/supabase-store");
  const db = createServiceClient(info.supabaseUrl);
  if (!db) throw new DomainError("SETUP_REQUIRED", "Machine publishing needs SUPABASE_SECRET_KEY on the server.");
  return wireContext("supabase", info.projectId, MACHINE_ACTOR, new SupabaseStore(db, info.projectId));
}
