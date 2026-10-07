import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, computeBundleHash } from "@/lib/contract/canonical";
import { LIMITS } from "@/lib/contract/schema";
import { buildPreview, parseBundle, parseBundleText } from "@/lib/domain/publication";
import { exampleBundle, seedBundle, setup, PROJECT } from "./helpers";

describe("canonical JSON and bundle hash", () => {
  it("sorts keys, omits undefined and keeps Unicode exact", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "Teruānga"], c: undefined })).toBe('{"a":[true,null,"Teruānga"],"b":1}');
  });
  it("is independent of key order and excludes the bundleHash field", () => {
    const a = seedBundle();
    const reordered = Object.fromEntries(Object.entries(a).reverse());
    expect(computeBundleHash(a)).toBe(computeBundleHash(reordered));
    expect(computeBundleHash({ ...a, bundleHash: "sha256:" + "0".repeat(64) })).toBe(computeBundleHash(a));
  });
  it("accepts a correct supplied bundleHash and rejects a wrong one", () => {
    const parsed = parseBundle(exampleBundle());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parseBundle({ ...exampleBundle(), bundleHash: parsed.hash }).ok).toBe(true);
    const bad = parseBundle({ ...exampleBundle(), bundleHash: "sha256:" + "a".repeat(64) });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues[0]!.code).toBe("HASH_MISMATCH");
  });
});

describe("fixtures", () => {
  it("seed and example bundles are valid", () => {
    expect(parseBundle(seedBundle()).ok).toBe(true);
    expect(parseBundle(exampleBundle()).ok).toBe(true);
  });

  it("every demo fixture record is flagged demo and non-canon", () => {
    const seed = seedBundle();
    for (const op of seed.operations) {
      const r = op.record as Record<string, unknown>;
      if (String(r.title ?? r.label ?? "").startsWith("Demo")) {
        expect(r.demo).toBe(true);
        expect(r.canonStatus).toBe("non_canon");
      }
    }
  });

  it("seeds the eight peoples with exact spelling and no invented descriptions", () => {
    const peoples = seedBundle()
      .operations.map((o) => o.record as Record<string, unknown>)
      .filter((r) => r.kind === "people");
    expect(peoples.map((p) => p.title).sort()).toEqual(["Blightmourn", "Irridosai", "Nyth’rok", "Obscarron", "Resonara", "Syntherion", "Teruānga", "Umbrasa"]);
    for (const p of peoples) expect(p.body).toMatch(/source material has not been supplied/i);
  });

  it("records the planet name as undecided and Primus only as a former working name", () => {
    const text = JSON.stringify(seedBundle());
    expect(text).toContain("former working name");
    const world = seedBundle().operations.map((o) => o.record as Record<string, unknown>).find((r) => r.title === "Future Earth")!;
    expect(world.title).not.toMatch(/Primus/);
  });

  it("does not invent source titles, revisions or hashes for the supplied PDFs", () => {
    const sources = seedBundle()
      .operations.map((o) => o.record as Record<string, unknown>)
      .filter((r) => r.type === "source" && String(r.url ?? "").includes("drive.google.com"));
    expect(sources).toHaveLength(2);
    for (const s of sources) {
      expect(s.title).toBeNull();
      expect(s.revision).toBeNull();
      expect(s.contentHash).toBeNull();
    }
  });
});

const invalidDir = path.join(process.cwd(), "fixtures/publication/invalid");
const expected: Record<string, string> = {
  "unsupported-schema-version.json": "UNSUPPORTED_SCHEMA_VERSION",
  "duplicate-ids.json": "DUPLICATE_ID",
  "bad-reference.json": "INVALID_REFERENCE",
  "unsafe-content.json": "UNSAFE_CONTENT",
  "unsafe-url.json": "UNSAFE_URL",
  "cross-project.json": "CROSS_PROJECT",
  "malformed-operation.json": "SCHEMA_INVALID",
  "invalid-type.json": "SCHEMA_INVALID",
  "tombstone-unconfirmed.json": "TOMBSTONE_NOT_CONFIRMED",
};

describe("invalid fixtures are rejected with specific codes", () => {
  it("covers every file in fixtures/publication/invalid", () => {
    expect(readdirSync(invalidDir).sort()).toEqual(Object.keys(expected).sort());
  });
  for (const [file, code] of Object.entries(expected)) {
    it(file, async () => {
      const { store } = await setup();
      const state = await store.getActiveState();
      const preview = buildPreview(parseBundleText(readFileSync(path.join(invalidDir, file), "utf8")), state, PROJECT);
      expect(preview.ok).toBe(false);
      expect(preview.issues.map((i) => i.code)).toContain(code);
    });
  }
});

describe("input limits", () => {
  it("rejects oversized bundles before parsing", () => {
    const r = parseBundleText(" ".repeat(LIMITS.maxBundleBytes + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it("rejects malformed JSON", () => {
    const r = parseBundleText("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_JSON");
  });
  it("rejects unknown top-level fields (no silent 'replace everything' modes)", () => {
    const r = parseBundle({ ...exampleBundle(), mode: "replace_all" });
    expect(r.ok).toBe(false);
  });
  it("rejects uppercase or malformed IDs", () => {
    const b = exampleBundle();
    b.releaseId = b.releaseId.toUpperCase();
    expect(parseBundle(b).ok).toBe(false);
  });
});
