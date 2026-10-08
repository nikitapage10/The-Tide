/**
 * Builds the lore release (fixtures/publication/lore-release.json) from the
 * catalog (lore/catalog.ts) and the GM's documents (lore/docs/*.md).
 *
 *   npx tsx scripts/build-lore-bundle.ts [--base <releaseId>] [--out <file>]
 *
 * --base defaults to the seed release. To publish on a live site whose active
 * release has moved on, pass that release's ID (Workshop → Publishing shows
 * it), or let the publisher fetch it from /api/v1/publications/active.
 * Record IDs are stable (src/lib/contract/ids.ts), so re-running and
 * re-publishing updates the same records.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ids from "../fixtures/ids.json";
import seed from "../fixtures/publication/seed-release.json";
import { ARCHIVE, ENTITIES, EXISTING, QUESTIONS, RELATIONS, SOURCES, type Body } from "../lore/catalog";
import { recordId } from "../src/lib/contract/ids";
import { parseBundleText } from "../src/lib/domain/publication";

const ROOT = process.cwd();
const PROJECT = ids.projectId;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const BASE = arg("--base") ?? seed.releaseId;
const OUT = arg("--out") ?? path.join(ROOT, "fixtures", "publication", "lore-release.json");

const idOf = (name: string) => EXISTING[name] ?? recordId(PROJECT, name);
const relName = (a: string, b: string) => `rel/${a.replace("/", "-")}-to-${b.replace("/", "-")}`;

const docs = new Map<string, string>();
function doc(name: string): string {
  if (!docs.has(name)) {
    const raw = readFileSync(path.join(ROOT, "lore", "docs", `${name}.md`), "utf8");
    docs.set(name, raw.replace(/^<!--.*?-->\n/, ""));
  }
  return docs.get(name)!;
}

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[:\s]+$/, "").trim().toLowerCase();

/** One section of a document: from its heading to the next heading of the same or a higher level (or `until`). */
function section(text: string, heading: string, until?: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#{2,3} /.test(l) && norm(l.replace(/^#+ /, "")) === norm(heading));
  if (start < 0) throw new Error(`section not found: "${heading}"`);
  const level = lines[start]!.match(/^#+/)![0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i]!.match(/^(#+) (.*)$/);
    if (!m) continue;
    if (until ? norm(m[2]!) === norm(until) : m[1]!.length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

function bodyOf(b: Body | undefined): string | null {
  if (b === undefined) return null;
  if (typeof b === "string") return b;
  const text = doc(b.doc);
  return b.section ? section(text, b.section, b.until) : text.trim();
}

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

const operations: unknown[] = [];

// Sources: one per document.
for (const [name, title] of Object.entries(SOURCES)) {
  operations.push({
    op: "upsert",
    record: {
      id: idOf(`source/${name}`),
      type: "source",
      title,
      url: null,
      documentId: null,
      revision: null,
      contentHash: `sha256:${sha(doc(name))}`,
      access: "private",
      notes: `The GM's document, converted to Markdown at lore/docs/${name}.md (the hash is of that Markdown).`,
      visibility: "gm_only",
      demo: false,
    },
  });
}

// Portraits.
const portraitIds = new Map<string, string>();
for (const e of ENTITIES) {
  if (!e.portrait) continue;
  const id = idOf(`media/portrait-${e.name.split("/")[1]}`);
  portraitIds.set(e.name, id);
  operations.push({
    op: "upsert",
    record: {
      id,
      type: "media",
      title: `${e.title}, portrait`,
      summary: null,
      mediaType: "artwork",
      stage: "approved",
      role: "portrait",
      url: e.portrait,
      linkedIds: [idOf(e.name)],
      canonStatus: e.canon ?? "provisional",
      visibility: e.visibility ?? "gm_only",
      demo: false,
      sourceRefs: e.source ? [{ sourceId: idOf(`source/${e.source}`) }] : undefined,
    },
  });
}

// Entities.
for (const e of ENTITIES) {
  const record: Record<string, unknown> = {
    id: idOf(e.name),
    type: "entity",
    kind: e.kind,
    title: e.title,
    slug: e.name.split("/")[1],
    summary: e.summary,
    body: bodyOf(e.body),
    canonStatus: e.canon ?? "provisional",
    visibility: e.visibility ?? "gm_only",
    demo: false,
  };
  if (e.aliases) record.aliases = e.aliases;
  if (e.tags) record.tags = e.tags;
  if (e.era) record.era = e.era;
  if (e.palette) record.palette = e.palette;
  if (e.parent) record.parentId = idOf(e.parent);
  if (e.chronology) record.chronology = { notes: null, sortKey: null, ...e.chronology };
  if (e.source) record.sourceRefs = [{ sourceId: idOf(`source/${e.source}`) }];
  if (portraitIds.has(e.name)) record.mediaIds = [portraitIds.get(e.name)];
  operations.push({ op: "upsert", record });
}

// The Intro, as a short piece addressed to the newly arrived.
operations.push({
  op: "upsert",
  record: {
    id: idOf("story/arrival"),
    type: "story",
    format: "short_fiction",
    continuity: "shared_canon",
    title: "Arrival",
    slug: "arrival",
    summary: "Breathe, little spark. An introduction for those who wash ashore.",
    // The haiku stands as an epigraph, its lines kept.
    body: doc("intro")
      .trim()
      .replace(/^(.+)\n(.+)\n(.+)\n/, "> $1  \n> $2  \n> $3\n"),
    draftStatus: "complete",
    relatedIds: [idOf("phenomenon/the-tide"), idOf("world/primus")],
    canonStatus: "provisional",
    visibility: "public",
    demo: false,
    sourceRefs: [{ sourceId: idOf("source/intro") }],
  },
});

// Relationships.
for (const r of RELATIONS) {
  operations.push({
    op: "upsert",
    record: {
      id: idOf(relName(r.from, r.to)),
      type: "relationship",
      fromId: idOf(r.from),
      toId: idOf(r.to),
      label: r.label,
      inverseLabel: r.inverse ?? null,
      note: r.note ?? null,
      canonStatus: "provisional",
      visibility: "player_safe",
      demo: false,
    },
  });
}

// Open questions (contradictions and gaps found in the documents).
for (const q of QUESTIONS) {
  operations.push({
    op: "upsert",
    record: {
      id: idOf(q.name),
      type: "open_question",
      title: q.title,
      summary: q.summary,
      body: q.body ?? null,
      status: q.status,
      relatedIds: q.related.map(idOf),
      canonStatus: "unverified",
      visibility: "gm_only",
      demo: false,
    },
  });
}

// Settled records from the first release.
for (const a of ARCHIVE) operations.push({ op: "archive", targetId: a.id, reason: a.reason });

const bundle = {
  schemaVersion: "tide.publication.v1",
  projectId: PROJECT,
  releaseId: recordId(PROJECT, "release/lore-from-documents-1"),
  baseReleaseId: BASE,
  createdAt: "2026-10-08T00:00:00Z",
  title: "Lore from the GM's documents",
  notes:
    "The Intro, Tide 101, the Nyth'rok, Obscarron, Teruānga, Umbrasa and Resonara documents and the Normandy Enclave: eras, peoples, factions, places, events, enclaves, portraits, relationships and the contradictions found, as open questions.",
  operations,
};

const text = JSON.stringify(bundle, null, 2) + "\n";
const parsed = parseBundleText(text);
if (!parsed.ok) {
  console.error(`invalid (${parsed.code}):`);
  for (const i of parsed.issues.slice(0, 20)) console.error(`  ${i.code} ${i.path ?? ""} ${i.message}`);
  process.exit(1);
}
writeFileSync(OUT, text);
console.log(`wrote ${path.relative(ROOT, OUT)}: ${operations.length} operations, ${parsed.hash}`);
