import "server-only";
/**
 * LOCAL DEMO PERSISTENCE — not production storage.
 *
 * Stores the whole demo dataset in one JSON file on the developer's machine
 * (default .tide-demo/state.json, git-ignored). It survives page refreshes and
 * dev-server restarts. Reset with the "Reset demo data" button, `npm run demo:reset`,
 * or by deleting the file.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MemoryStore, type StoreDoc } from "./memory-store";
import { buildSeededDoc } from "./demo-seed";

export function demoStatePath(): string {
  return path.resolve(process.env.TIDE_DEMO_STATE_FILE || path.join(process.cwd(), ".tide-demo", "state.json"));
}

async function readDoc(file: string): Promise<StoreDoc | null> {
  try {
    const doc = JSON.parse(await fs.readFile(file, "utf8")) as StoreDoc;
    return doc.formatVersion === 1 ? doc : null;
  } catch {
    return null;
  }
}

async function writeDoc(file: string, doc: StoreDoc) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
  await fs.rename(tmp, file); // atomic replace on the same filesystem
}

let storePromise: Promise<MemoryStore> | null = null;

export function getDemoFileStore(): Promise<MemoryStore> {
  storePromise ??= (async () => {
    const file = demoStatePath();
    let doc = await readDoc(file);
    if (!doc) {
      doc = await buildSeededDoc();
      await writeDoc(file, doc);
    }
    return new MemoryStore(doc, {
      load: async () => (await readDoc(file)) ?? (await reseed(file)),
      persist: (d) => writeDoc(file, d),
    });
  })();
  return storePromise;
}

async function reseed(file: string): Promise<StoreDoc> {
  const doc = await buildSeededDoc();
  await writeDoc(file, doc);
  return doc;
}

export async function resetDemoStore(): Promise<void> {
  await reseed(demoStatePath());
}
