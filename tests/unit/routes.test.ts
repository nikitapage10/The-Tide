/**
 * Calls the real route handlers (demo adapter) to check authentication,
 * authorization, CSRF, ownership and response hygiene end to end.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import lore from "@fixtures/publication/lore-release.json";
import { ID } from "./helpers";

/** The demo store holds the seed and the lore release; examples are prepared against the latter. */
const example = () => {
  const b = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures/publication/example-minimal.json"), "utf8"));
  return JSON.stringify({ ...b, baseReleaseId: lore.releaseId });
};

const ORIGIN = "http://localhost:3000";
const TOKEN = "machine-publisher-token-for-tests-only-abcdef";

function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${url}`, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, "sec-fetch-site": "same-origin", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}
const params = <T,>(o: T) => ({ params: Promise.resolve(o) });

const saved = { ...process.env };
beforeEach(() => {
  vi.resetModules();
  process.env = { ...saved, NODE_ENV: "test" };
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  process.env.TIDE_DEMO_STATE_FILE = path.join(mkdtempSync(path.join(tmpdir(), "tide-")), "state.json");
});
afterEach(() => {
  process.env = saved;
  vi.doUnmock("@/lib/server/supabase");
});

describe("setup-required (fail closed)", () => {
  it("API refuses with 503 and no data when TIDE_DATA_MODE is unset", async () => {
    delete process.env.TIDE_DATA_MODE;
    const { GET } = await import("@/app/api/v1/publications/releases/route");
    const res = await GET(req("/api/v1/publications/releases", "GET"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: { code: "SETUP_REQUIRED", message: expect.any(String) } });
  });
  it("half-configured supabase mode fails closed instead of using demo data", async () => {
    process.env.TIDE_DATA_MODE = "supabase"; // incomplete config
    const { POST } = await import("@/app/api/v1/publications/publish/route");
    const res = await POST(req("/api/v1/publications/publish", "POST", "{}"));
    expect(res.status).toBe(503);
  });
});

describe("demo mode API", () => {
  beforeEach(() => {
    process.env.TIDE_DATA_MODE = "demo";
  });

  it("rejects cookie-style mutations without a same-origin Origin header", async () => {
    const { POST } = await import("@/app/api/v1/print-jobs/route");
    const res = await POST(req("/api/v1/print-jobs", "POST", { title: "x", requestedQuantity: 1 }, { origin: "https://evil.example", "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("CSRF_REJECTED");
  });

  it("validates server-side even if a form would have", async () => {
    const { POST } = await import("@/app/api/v1/print-jobs/route");
    const res = await POST(req("/api/v1/print-jobs", "POST", { title: "", requestedQuantity: -2 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.error.details.fieldErrors)).toEqual(expect.arrayContaining(["title", "requestedQuantity"]));
  });

  it("refuses source-owned fields on live endpoints", async () => {
    const { PATCH } = await import("@/app/api/v1/sessions/[id]/state/route");
    const res = await PATCH(req(`/api/v1/sessions/${ID.ss_1}/state`, "PATCH", { expectedRevision: 0, recap: "rewritten canon" }), params({ id: ID.ss_1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("FIELD_NOT_ALLOWED");
  });

  it("validates without writing, then publishes, with no-store caching", async () => {
    const bundle = example();
    const v = await (await import("@/app/api/v1/publications/validate/route")).POST(req("/api/v1/publications/validate", "POST", bundle));
    expect(v.status).toBe(200);
    expect(v.headers.get("cache-control")).toContain("no-store");
    expect((await v.json()).preview.ok).toBe(true);
    const before = readFileSync(process.env.TIDE_DEMO_STATE_FILE!, "utf8");
    expect(JSON.parse(before).project.releaseCount).toBe(2);

    const p = await (await import("@/app/api/v1/publications/publish/route")).POST(req("/api/v1/publications/publish", "POST", bundle));
    expect(p.status).toBe(201);
    const again = await (await import("@/app/api/v1/publications/publish/route")).POST(req("/api/v1/publications/publish", "POST", bundle));
    expect(again.status).toBe(200);
    expect((await again.json()).status).toBe("replayed");
  });

  it("machine publisher: rejected when unconfigured or wrong, accepted with the configured token", async () => {
    const bundle = example();
    const call = async (auth: string) => (await import("@/app/api/v1/publications/publish/route")).POST(req("/api/v1/publications/publish", "POST", bundle, { authorization: auth, origin: "" }));
    expect((await call(`Bearer ${TOKEN}`)).status).toBe(401);
    process.env.TIDE_PUBLISHER_TOKEN_SHA256 = createHash("sha256").update(TOKEN).digest("hex");
    expect((await call("Bearer wrong-token-wrong-token-wrong-token-xx")).status).toBe(401);
    const ok = await call(`Bearer ${TOKEN}`);
    expect(ok.status).toBe(201);
    expect((await ok.json()).release.publishedBy.kind).toBe("machine");
  });

  it("bearer credentials cannot be used on live or rollback endpoints", async () => {
    process.env.TIDE_PUBLISHER_TOKEN_SHA256 = createHash("sha256").update(TOKEN).digest("hex");
    const { POST } = await import("@/app/api/v1/publications/rollback/route");
    const res = await POST(req("/api/v1/publications/rollback", "POST", {}, { authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(403);
  });

  it("private assets are unavailable in demo mode rather than pretending", async () => {
    const { GET } = await import("@/app/api/v1/assets/[mediaId]/route");
    const res = await GET(req(`/api/v1/assets/${ID.m_private}`, "GET"), params({ mediaId: ID.m_private }));
    expect(res.status).toBe(503);
    expect(res.headers.get("location")).toBeNull();
  });

  it("error responses do not leak stack traces", async () => {
    const { POST } = await import("@/app/api/v1/publications/validate/route");
    const res = await POST(req("/api/v1/publications/validate", "POST", "{broken"));
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).not.toMatch(/at .*\.ts:\d+/);
  });
});

describe("supabase mode authentication and authorization (stubbed Supabase client)", () => {
  function stubClient(user: { id: string; email: string } | null, role: string | null, publicRead = false) {
    const rows: Record<string, unknown> = {
      project_members: role ? { role } : null,
      projects: publicRead ? { id: "11111111-2222-4333-8444-555555555555", name: "P", active_release_id: null, release_count: 0 } : null,
    };
    const query = (table: string) => {
      const q: Record<string, unknown> = {};
      const chain = () => q;
      Object.assign(q, {
        select: chain,
        eq: chain,
        order: chain,
        limit: chain,
        range: chain,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      });
      return q;
    };
    return {
      auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: "no session" } }) },
      from: query,
    };
  }
  beforeEach(() => {
    process.env.TIDE_DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_stub";
    process.env.TIDE_PROJECT_ID = "11111111-2222-4333-8444-555555555555";
  });

  it("returns 401 for private reads and publishing without a session", async () => {
    vi.doMock("@/lib/server/supabase", () => ({ createUserClient: async () => stubClient(null, null), createServiceClient: () => null }));
    const releases = await (await import("@/app/api/v1/publications/releases/route")).GET(req("/api/v1/publications/releases", "GET"));
    expect(releases.status).toBe(401);
    const publish = await (await import("@/app/api/v1/publications/publish/route")).POST(req("/api/v1/publications/publish", "POST", "{}"));
    expect(publish.status).toBe(401);
  });

  it("returns 403 for a signed-in user who is not a GM of the project", async () => {
    vi.doMock("@/lib/server/supabase", () => ({ createUserClient: async () => stubClient({ id: "u1", email: "other@example.test" }, null), createServiceClient: () => null }));
    const releases = await (await import("@/app/api/v1/publications/releases/route")).GET(req("/api/v1/publications/releases", "GET"));
    expect(releases.status).toBe(403);
    const body = await releases.json();
    expect(JSON.stringify(body)).not.toContain("releases\":[");
  });

  it("public project: visitors can read but every change and publish is refused", async () => {
    vi.doMock("@/lib/server/supabase", () => ({ createUserClient: async () => stubClient(null, null, true), createServiceClient: () => null }));
    const releases = await (await import("@/app/api/v1/publications/releases/route")).GET(req("/api/v1/publications/releases", "GET"));
    expect(releases.status).toBe(200);
    expect((await releases.json()).events).toEqual([]);
    const publish = await (await import("@/app/api/v1/publications/publish/route")).POST(req("/api/v1/publications/publish", "POST", "{}"));
    expect(publish.status).toBe(401);
    const note = await (await import("@/app/api/v1/gm-notes/route")).POST(req("/api/v1/gm-notes", "POST", { subjectId: ID.ss_1, body: "x" }));
    expect(note.status).toBe(401);
    const asset = await (await import("@/app/api/v1/assets/[mediaId]/route")).GET(req(`/api/v1/assets/${ID.m_private}`, "GET"), params({ mediaId: ID.m_private }));
    expect([401, 404]).toContain(asset.status);
  });

  it("machine publishing needs the server secret key even with a valid token", async () => {
    process.env.TIDE_PUBLISHER_TOKEN_SHA256 = createHash("sha256").update(TOKEN).digest("hex");
    vi.doMock("@/lib/server/supabase", () => ({ createUserClient: async () => stubClient(null, null), createServiceClient: () => null }));
    const res = await (await import("@/app/api/v1/publications/publish/route")).POST(req("/api/v1/publications/publish", "POST", "{}", { authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(503);
  });
});
