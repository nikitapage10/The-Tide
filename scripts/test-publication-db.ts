/** Runs only in scripts/test-db.sh's throwaway cluster. */
import assert from "node:assert/strict";
import { PostgresPublicationStore } from "./postgres-publication-store";
import { PublicationService } from "../src/lib/domain/publication";
import seed from "../fixtures/publication/seed-release.json";
import lore from "../fixtures/publication/lore-release.json";
async function main() {
  const connection = process.env.TIDE_TEST_DB_URL;
  if (!connection)
    throw new Error("Only run inside the throwaway database harness.");
  const store = new PostgresPublicationStore(connection, seed.projectId);
  const service = new PublicationService(store, seed.projectId);
  const actor = {
    kind: "machine" as const,
    id: "machine-publisher",
    label: "Machine publisher",
  };
  assert.equal((await store.getActiveState()).version, 0);
  assert.equal((await service.publish(seed, actor)).status, "applied");
  assert.equal((await service.publish(lore, actor)).status, "applied");
  assert.equal((await service.publish(lore, actor)).status, "replayed");
  const state = await store.getActiveState();
  const peoples = Object.values(state.records).filter(
    (r) =>
      r.lifecycle === "active" &&
      r.record?.type === "entity" &&
      r.record.kind === "people" &&
      !r.record.tags?.includes("enclave"),
  );
  assert.equal(peoples.length, 9);
  assert.ok(
    peoples.every((r) => r.record && "body" in r.record && r.record.body),
  );
  assert.equal((await store.listReleases()).length, 2);
  assert.ok(
    (await store.listPublicationEvents(10)).some(
      (e) => e.outcome === "replayed",
    ),
  );
  assert.equal(
    await store.getRelease("00000000-0000-4000-8000-000000000000"),
    null,
  );
  console.log(
    "Postgres publisher: seed, complete lore, replay, history and nine full peoples verified.",
  );
}
main().catch(() => {
  console.error("Postgres publisher integration test failed.");
  process.exit(1);
});
