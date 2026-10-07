/**
 * Builds a fresh demo/test store by publishing the seed bundle through the
 * real PublicationService and then loading the demo live fixtures.
 */
import ids from "@fixtures/ids.json";
import liveFixture from "@fixtures/live/demo-live.json";
import seedBundle from "@fixtures/publication/seed-release.json";
import { PublicationService } from "@/lib/domain/publication";
import type { Actor } from "@/lib/domain/types";
import { MemoryStore, emptyDoc, type MemoryStoreOptions, type StoreDoc } from "./memory-store";

export const DEMO_PROJECT_ID: string = ids.projectId;
export const DEMO_PROJECT_NAME: string = ids.projectName;
export const FIXTURE_IDS: Record<string, string> = ids.ids;

/** The only identity demo mode ever uses. Production never accepts it. */
export const DEMO_ACTOR: Actor = { kind: "demo", id: "demo-gm", label: "Demo GM (local demo mode)" };

export async function buildSeededDoc(opts: Pick<MemoryStoreOptions, "now"> = {}): Promise<StoreDoc> {
  const store = new MemoryStore(emptyDoc({ id: DEMO_PROJECT_ID, name: DEMO_PROJECT_NAME }), opts);
  const service = new PublicationService(store, DEMO_PROJECT_ID);
  await service.publish(seedBundle, { kind: "demo", id: "seed", label: "Seed fixtures" });
  const doc = store.snapshotDoc();
  const live = liveFixture as unknown as Pick<StoreDoc, "sessionStates" | "checklist" | "gmNotes" | "printJobs" | "printAttempts" | "builds" | "activity">;
  return {
    ...doc,
    sessionStates: live.sessionStates,
    checklist: live.checklist,
    gmNotes: live.gmNotes,
    printJobs: live.printJobs,
    printAttempts: live.printAttempts,
    builds: live.builds,
    activity: live.activity,
    // Seeding is setup, not an audited publication by a person.
    publicationEvents: [],
  };
}

export async function createSeededMemoryStore(opts: MemoryStoreOptions = {}): Promise<MemoryStore> {
  return new MemoryStore(await buildSeededDoc(opts), opts);
}
