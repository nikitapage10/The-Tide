import "server-only";
/**
 * Request context: resolves mode, authenticates, authorizes the GM and wires
 * the shared services to the right adapter. Every page and API route goes
 * through here; there is no other path to project data.
 */
import { cache } from "react";
import { DEMO_ACTOR } from "@/lib/data/demo-seed";
import { DomainError } from "@/lib/domain/errors";
import { OperationsService } from "@/lib/domain/operations";
import type { OperationalStore, PublicationStore } from "@/lib/domain/ports";
import { PublicationService } from "@/lib/domain/publication";
import type { Actor } from "@/lib/domain/types";
import { resolveMode, type ModeInfo } from "./config";

export interface AppContext {
  mode: "demo" | "supabase";
  projectId: string;
  actor: Actor;
  publicationStore: PublicationStore;
  operationalStore: OperationalStore;
  publication: PublicationService;
  operations: OperationsService;
  /** Issues a short-lived signed URL for a private asset after authorization; null when storage is unavailable. */
  signAsset: ((bucket: string, path: string) => Promise<string | null>) | null;
}

export type ContextResult =
  | { status: "ok"; ctx: AppContext }
  | { status: "setup-required"; info: Extract<ModeInfo, { mode: "setup-required" }> }
  | { status: "unauthenticated" }
  | { status: "forbidden"; email: string | null };

export function wireContext(
  mode: "demo" | "supabase",
  projectId: string,
  actor: Actor,
  store: PublicationStore & OperationalStore,
  signAsset: AppContext["signAsset"] = null,
): AppContext {
  return {
    signAsset,
    mode,
    projectId,
    actor,
    publicationStore: store,
    operationalStore: store,
    publication: new PublicationService(store, projectId),
    operations: new OperationsService({ store, projectId, getPublishedState: () => store.getActiveState(), demo: mode === "demo" }),
  };
}

export const getAppContext = cache(async (): Promise<ContextResult> => {
  const info = resolveMode();
  if (info.mode === "setup-required") return { status: "setup-required", info };

  if (info.mode === "demo") {
    const { getDemoFileStore } = await import("@/lib/data/demo-file-store");
    return { status: "ok", ctx: wireContext("demo", info.projectId, DEMO_ACTOR, await getDemoFileStore()) };
  }

  const { createUserClient } = await import("./supabase");
  const { SupabaseStore } = await import("@/lib/data/supabase-store");
  const db = await createUserClient(info.supabaseUrl, info.supabaseKey);
  // getUser() verifies the JWT with Supabase Auth (getSession() alone is not trusted).
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return { status: "unauthenticated" };
  const { data: member } = await db
    .from("project_members")
    .select("role")
    .eq("project_id", info.projectId)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (member?.role !== "gm") return { status: "forbidden", email: data.user.email ?? null };
  const actor: Actor = { kind: "user", id: data.user.id, label: data.user.email ?? "GM" };
  const signAsset = async (bucket: string, path: string) => {
    // Storage RLS re-checks GM membership; URLs expire after 60 s and are never stored.
    const { data: signed, error: signError } = await db.storage.from(bucket).createSignedUrl(path, 60);
    return signError ? null : signed.signedUrl;
  };
  return { status: "ok", ctx: wireContext("supabase", info.projectId, actor, new SupabaseStore(db, info.projectId), signAsset) };
});

/** For API routes: throws a DomainError instead of redirecting. */
export async function requireApiContext(): Promise<AppContext> {
  const result = await getAppContext();
  switch (result.status) {
    case "ok":
      return result.ctx;
    case "setup-required":
      throw new DomainError("SETUP_REQUIRED", "The dashboard is not configured. See /setup.");
    case "unauthenticated":
      throw new DomainError("UNAUTHENTICATED", "Sign in first.");
    case "forbidden":
      throw new DomainError("FORBIDDEN", "Your account is not a GM of this project.");
  }
}
