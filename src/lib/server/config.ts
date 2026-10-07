import "server-only";
/**
 * Runtime mode resolution. Fails closed:
 *  - TIDE_DATA_MODE unset or unknown        → setup-required
 *  - TIDE_DATA_MODE=demo on Vercel           → setup-required (demo is local-only)
 *  - TIDE_DATA_MODE=demo in a production build without
 *    TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD=true → setup-required
 *  - TIDE_DATA_MODE=supabase with missing settings → setup-required (lists names only)
 * There is no silent fallback from supabase to demo.
 */
import { UUID_PATTERN } from "@/lib/contract/schema";

export type ModeInfo =
  | { mode: "demo"; projectId: string; reason: null }
  | { mode: "supabase"; projectId: string; supabaseUrl: string; supabaseKey: string; reason: null }
  | { mode: "setup-required"; reason: string; missing: string[] };

export function resolveMode(env: NodeJS.ProcessEnv = process.env): ModeInfo {
  // When TIDE_DATA_MODE is unset but Supabase is configured (e.g. by the Vercel ↔ Supabase
  // integration), use Supabase. Sign-in and GM membership are still required; there is
  // never a fallback to demo data.
  const hasSupabase = Boolean(supabaseUrlFrom(env) && supabaseKeyFrom(env));
  const requested = env.TIDE_DATA_MODE?.trim() || (hasSupabase ? "supabase" : undefined);
  if (requested === "demo") {
    if (env.VERCEL || env.VERCEL_ENV) {
      return { mode: "setup-required", reason: "Demo mode is local-only and is disabled on Vercel deployments. Configure Supabase.", missing: [] };
    }
    if (env.NODE_ENV === "production" && env.TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD !== "true") {
      return {
        mode: "setup-required",
        reason: "Demo mode is disabled in production builds. For a local production-build preview only, set TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD=true.",
        missing: [],
      };
    }
    return { mode: "demo", projectId: demoProjectId(), reason: null };
  }
  if (requested === "supabase") {
    const supabaseUrl = supabaseUrlFrom(env);
    const supabaseKey = supabaseKeyFrom(env);
    // Defaults to the project row created by supabase/seed.sql.
    const projectId = env.TIDE_PROJECT_ID?.trim() || DEMO_PROJECT_ID_CONST;
    const missing: string[] = [];
    if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(supabaseUrl)) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    if (!UUID_PATTERN.test(projectId)) missing.push("TIDE_PROJECT_ID");
    if (missing.length) return { mode: "setup-required", reason: "Supabase mode is selected but not fully configured.", missing };
    return { mode: "supabase", projectId, supabaseUrl, supabaseKey, reason: null };
  }
  if (requested) {
    return { mode: "setup-required", reason: `Unknown TIDE_DATA_MODE "${requested}". Use "supabase" (or "demo" locally).`, missing: [] };
  }
  return {
    mode: "setup-required",
    reason: "No Supabase connection was found on the server.",
    missing: [!supabaseUrlFrom(env) && "NEXT_PUBLIC_SUPABASE_URL", !supabaseKeyFrom(env) && "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"].filter(
      (m): m is string => Boolean(m),
    ),
  };
}

/** Accepts the public names and the server-side names the Vercel ↔ Supabase integration may set. */
export function supabaseUrlFrom(env: NodeJS.ProcessEnv): string {
  return (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || bySuffix(env, "SUPABASE_URL")).trim();
}
export function supabaseKeyFrom(env: NodeJS.ProcessEnv): string {
  return (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    bySuffix(env, "SUPABASE_PUBLISHABLE_KEY") ||
    bySuffix(env, "SUPABASE_ANON_KEY")
  ).trim();
}

/** The Vercel integration can add a custom prefix (e.g. STORAGE_SUPABASE_URL). Only public-safe names are matched. */
function bySuffix(env: NodeJS.ProcessEnv, suffix: string): string {
  const key = Object.keys(env)
    .filter((k) => k.endsWith(`_${suffix}`))
    .sort()[0];
  return (key && env[key]) || "";
}

// Kept in sync with fixtures/ids.json and supabase/seed.sql (asserted by tests).
export const DEMO_PROJECT_ID_CONST = "333ea628-f6a1-4f3a-8b83-ce98d12f2565";
function demoProjectId(): string {
  return DEMO_PROJECT_ID_CONST;
}

/** Non-secret summary safe to show on the settings page. */
export function configSummary(env: NodeJS.ProcessEnv = process.env) {
  const info = resolveMode(env);
  return {
    mode: info.mode,
    reason: info.reason,
    missing: info.mode === "setup-required" ? info.missing : [],
    supabaseUrlSet: Boolean(supabaseUrlFrom(env)),
    publishableKeySet: Boolean(supabaseKeyFrom(env)),
    projectIdSet: Boolean(env.TIDE_PROJECT_ID),
    serviceKeySet: Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
    machinePublisherConfigured: Boolean(env.TIDE_PUBLISHER_TOKEN_SHA256),
    storageBucket: "tide-private",
  };
}
