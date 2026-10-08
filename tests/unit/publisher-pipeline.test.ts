/**
 * The automatic publishing pipeline: deterministic IDs, the machine
 * publisher's read endpoints, its guard rails, and the audience layers.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordId, slugify, uuidV5 } from "@/lib/contract/ids";
import { canSee, filterForAudience } from "@/lib/domain/audience";
import { PROJECT, setup } from "./helpers";

const ORIGIN = "http://localhost:3000";
const TOKEN = "machine-publisher-token-for-tests-only-abcdef";
const bearer = (url: string, method = "GET", body?: string) =>
  new Request(`${ORIGIN}${url}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body });

describe("deterministic IDs", () => {
  it("matches the RFC 9562 UUIDv5 test vector", () => {
    expect(uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });
  it("derives the same ID for the same name, and different ones otherwise", () => {
    expect(recordId(PROJECT, "people/teruanga")).toBe(recordId(PROJECT, "people/teruanga"));
    expect(recordId(PROJECT, "people/teruanga")).not.toBe(recordId(PROJECT, "people/obscarron"));
    expect(() => recordId(PROJECT, "Teruānga")).toThrow();
  });
  it("slugs strip accents and apostrophes", () => {
    expect(slugify("Teruānga")).toBe("teruanga");
    expect(slugify("Nyth'rok")).toBe("nythrok");
    expect(slugify("The Normandy Enclave")).toBe("the-normandy-enclave");
  });
});

describe("audience layers", () => {
  it("each audience sees its tier and wider ones only", () => {
    expect(canSee("gm", "gm_only")).toBe(true);
    expect(canSee("player", "gm_only")).toBe(false);
    expect(canSee("player", "player_safe")).toBe(true);
    expect(canSee("public", "player_safe")).toBe(false);
    expect(canSee("public", "public")).toBe(true);
  });
  it("filters records, drops dangling relationships and strips GM-only fields", async () => {
    const { store } = await setup();
    const state = await store.getActiveState();
    const pub = filterForAudience(state, "public");
    for (const rs of Object.values(pub.records)) {
      expect(rs.record?.visibility).toBe("public");
    }
    const ids = new Set(Object.keys(pub.records));
    for (const rs of Object.values(pub.records)) {
      const r = rs.record!;
      if (r.type === "relationship") expect(ids.has(r.fromId) && ids.has(r.toId)).toBe(true);
      expect("sourceRefs" in r).toBe(false);
    }
    expect(filterForAudience(state, "gm")).toBe(state);
  });
});

describe("machine publisher endpoints (demo adapter)", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...saved, NODE_ENV: "test", TIDE_DATA_MODE: "demo" };
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    process.env.TIDE_DEMO_STATE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "tide-")), "state.json");
    process.env.TIDE_PUBLISHER_TOKEN_SHA256 = createHash("sha256").update(TOKEN).digest("hex");
  });
  afterEach(() => {
    process.env = saved;
  });

  it("reports the active release and an index of records", async () => {
    const active = await (await import("@/app/api/v1/publications/active/route")).GET(bearer("/api/v1/publications/active"));
    expect(active.status).toBe(200);
    const a = await active.json();
    expect(a.projectId).toBe(PROJECT);
    expect(a.activeReleaseId).toMatch(/^[0-9a-f-]{36}$/);
    const index = await (await import("@/app/api/v1/records/index/route")).GET(bearer("/api/v1/records/index"));
    const body = await index.json();
    expect(body.records.length).toBeGreaterThan(0);
    expect(body.records[0]).not.toHaveProperty("body");
  });

  it("refuses a wrong token on the read endpoints", async () => {
    process.env.TIDE_PUBLISHER_TOKEN_SHA256 = createHash("sha256").update("something-else-entirely-0123456789").digest("hex");
    const res = await (await import("@/app/api/v1/records/index/route")).GET(bearer("/api/v1/records/index"));
    expect(res.status).toBe(401);
  });

  it("cannot tombstone", async () => {
    const bundle = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures/publication/example-minimal.json"), "utf8"));
    bundle.operations = [{ op: "tombstone", targetId: bundle.operations[0].record?.id ?? PROJECT, confirmTargetId: bundle.operations[0].record?.id ?? PROJECT, reason: "x" }];
    const res = await (await import("@/app/api/v1/publications/validate/route")).POST(bearer("/api/v1/publications/validate", "POST", JSON.stringify(bundle)));
    expect(res.status).toBe(403);
  });

  it("is rate limited", async () => {
    const { machineRateLimit, MACHINE_LIMIT } = await import("@/lib/server/api");
    const t0 = 1_000_000;
    for (let i = 0; i < MACHINE_LIMIT.max; i++) machineRateLimit(t0 + i);
    expect(() => machineRateLimit(t0 + MACHINE_LIMIT.max)).toThrow(/Too many/);
    expect(() => machineRateLimit(t0 + MACHINE_LIMIT.windowMs + MACHINE_LIMIT.max + 1)).not.toThrow();
  });

  it("serves an OpenAPI document for the GPT Action", async () => {
    const res = await (await import("@/app/api/v1/openapi.json/route")).GET(new Request(`${ORIGIN}/api/v1/openapi.json`));
    const doc = await res.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toContain("/api/v1/publications/publish");
    expect(doc.servers[0].url).toBe(ORIGIN);
  });
});
