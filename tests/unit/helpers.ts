import ids from "@fixtures/ids.json";
import seed from "@fixtures/publication/seed-release.json";
import example from "@fixtures/publication/example-minimal.json";
import { createSeededMemoryStore } from "@/lib/data/demo-seed";
import type { MemoryStoreOptions } from "@/lib/data/memory-store";
import { OperationsService } from "@/lib/domain/operations";
import { PublicationService } from "@/lib/domain/publication";
import type { Actor } from "@/lib/domain/types";

export const ID = ids.ids;
export const PROJECT = ids.projectId;
export const SEED_RELEASE = ids.seedReleaseId;
export const GM: Actor = { kind: "user", id: "gm-1", label: "gm@example.test" };
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const seedBundle = () => clone(seed);
export const exampleBundle = () => clone(example) as typeof example & Record<string, unknown>;

let counter = 0;
export function uuid(n?: number): string {
  const x = (n ?? ++counter).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${x}`;
}

export async function setup(opts: MemoryStoreOptions = {}) {
  const store = await createSeededMemoryStore(opts);
  const publication = new PublicationService(store, PROJECT);
  const operations = new OperationsService({ store, projectId: PROJECT, getPublishedState: () => store.getActiveState() });
  return { store, publication, operations };
}
