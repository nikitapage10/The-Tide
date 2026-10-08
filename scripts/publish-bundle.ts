/**
 * Publishes a bundle to the live project with the server key, through the
 * normal validated publication path (it shows in the release history and can
 * be rolled back). The bundle is prepared against the active release first.
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run publish:bundle -- <bundle.json>
 *   npm run publish:lore     (rebuilds the lore release from lore/ and publishes it)
 *
 * Validates first and stops on any error. The key is read from the
 * environment only and never written anywhere.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { uuidV5 } from "../src/lib/contract/ids";
import { SupabaseStore } from "../src/lib/data/supabase-store";
import { PublicationService } from "../src/lib/domain/publication";

const PROJECT = process.env.TIDE_PROJECT_ID || "333ea628-f6a1-4f3a-8b83-ce98d12f2565";

async function main() {
  const file = process.argv[2];
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!file || !url || !key) {
    console.error("usage: SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run publish:bundle -- <bundle.json>");
    process.exit(2);
  }
  const store = new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), PROJECT);
  const state = await store.getActiveState();
  const raw = JSON.parse(readFileSync(file, "utf8"));
  // Prepared against what is live now; archive steps for records this site never had are dropped.
  const operations = (raw.operations as { op: string; targetId?: string }[]).filter((o) => o.op !== "archive" || (o.targetId && state.records[o.targetId]));
  const bundle = { ...raw, operations, baseReleaseId: state.releaseId, releaseId: uuidV5(PROJECT, `${raw.releaseId}:${state.releaseId ?? "first"}`) };
  const svc = new PublicationService(store, PROJECT);
  const preview = await svc.preview(bundle);
  console.log(`live: v${state.version} · this bundle:`, preview.counts);
  for (const i of preview.issues) console.log(`  ${i.severity} ${i.code} ${i.path ?? ""} ${i.message}`);
  if (!preview.ok) {
    console.error("not published: fix the errors above");
    process.exit(1);
  }
  const result = await svc.publish(bundle, { kind: "machine", id: "machine-publisher", label: "Machine publisher" });
  console.log(`${result.status}: release v${result.release?.version ?? "?"}`);
}

main().catch((e) => {
  console.error("failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
