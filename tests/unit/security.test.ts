import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { checkExternalUrl, checkMarkdown, safeHref } from "@/lib/contract/safety";
import { Markdown } from "@/components/ui/Markdown";
import { resolveMode } from "@/lib/server/config";
import { assertSameOrigin, readJson } from "@/lib/server/http";
import { verifyPublisherToken } from "@/lib/server/publisher-auth";
import { projectForPlayers } from "@/lib/domain/player-projection";
import { DomainError } from "@/lib/domain/errors";
import ids from "@fixtures/ids.json";
import { ID, setup } from "./helpers";

const env = (o: Record<string, string>) => ({ NODE_ENV: "development", ...o }) as unknown as NodeJS.ProcessEnv;

describe("mode resolution fails closed", () => {
  it("requires explicit configuration", () => {
    expect(resolveMode(env({})).mode).toBe("setup-required");
    expect(resolveMode(env({ TIDE_DATA_MODE: "prod" })).mode).toBe("setup-required");
  });
  it("never runs demo mode on Vercel or in an unflagged production build", () => {
    expect(resolveMode(env({ TIDE_DATA_MODE: "demo", VERCEL: "1" })).mode).toBe("setup-required");
    expect(resolveMode(env({ TIDE_DATA_MODE: "demo", NODE_ENV: "production" })).mode).toBe("setup-required");
    expect(resolveMode(env({ TIDE_DATA_MODE: "demo", NODE_ENV: "production", TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD: "true", VERCEL_ENV: "production" })).mode).toBe("setup-required");
    expect(resolveMode(env({ TIDE_DATA_MODE: "demo" })).mode).toBe("demo");
  });
  it("does not fall back to demo when Supabase is half-configured, and names only what is missing", () => {
    const r = resolveMode(env({ TIDE_DATA_MODE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }));
    expect(r.mode).toBe("setup-required");
    if (r.mode === "setup-required") expect(r.missing).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TIDE_PROJECT_ID"]);
  });
  it("keeps the demo project ID in sync with fixtures", () => {
    const r = resolveMode(env({ TIDE_DATA_MODE: "demo" }));
    expect(r.mode === "demo" && r.projectId).toBe(ids.projectId);
  });
});

describe("CSRF / origin checks", () => {
  const req = (h: Record<string, string>) => new Request("https://tide.example/api/v1/print-jobs", { method: "POST", headers: h });
  const rejects = (h: Record<string, string>) => {
    try {
      assertSameOrigin(req(h));
      return false;
    } catch (e) {
      return e instanceof DomainError && e.code === "CSRF_REJECTED";
    }
  };
  it("accepts same-origin requests", () => expect(rejects({ origin: "https://tide.example", "sec-fetch-site": "same-origin" })).toBe(false));
  it("rejects a missing Origin", () => expect(rejects({})).toBe(true));
  it("rejects a foreign Origin", () => expect(rejects({ origin: "https://evil.example" })).toBe(true));
  it("rejects cross-site fetch metadata", () => expect(rejects({ origin: "https://tide.example", "sec-fetch-site": "cross-site" })).toBe(true));
  it("requires JSON bodies and enforces size limits", async () => {
    const form = new Request("https://tide.example/x", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=1" });
    await expect(readJson(form, 100)).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    const big = new Request("https://tide.example/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: "x".repeat(200) }) });
    await expect(readJson(big, 100)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});

describe("machine publisher token adapter", () => {
  const token = "a-long-random-token-for-tests-only-0123456789";
  const hash = createHash("sha256").update(token).digest("hex");
  it("accepts only the configured token", () => {
    expect(verifyPublisherToken(`Bearer ${token}`, hash)).toBe(true);
    expect(verifyPublisherToken(`Bearer ${token}x`, hash)).toBe(false);
    expect(verifyPublisherToken(null, hash)).toBe(false);
  });
  it("rejects everything when unconfigured", () => {
    expect(verifyPublisherToken(`Bearer ${token}`, undefined)).toBe(false);
    expect(verifyPublisherToken(`Bearer ${token}`, "")).toBe(false);
  });
});

describe("untrusted content", () => {
  it("rejects unsafe URL protocols and embedded credentials", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "vbscript:x", "https://user:pw@host/x", "//evil.example"]) {
      expect(checkExternalUrl(bad).ok).toBe(false);
    }
    expect(checkExternalUrl("https://example.com/a").ok).toBe(true);
    expect(safeHref("JaVaScRiPt:alert(1)")).toBeNull();
  });
  it("flags dangerous Markdown", () => {
    expect(checkMarkdown("<script>x</script>").some((i) => i.severity === "error")).toBe(true);
    expect(checkMarkdown("[x](javascript:alert(1))").some((i) => i.severity === "error")).toBe(true);
    expect(checkMarkdown('<img src=x onerror="alert(1)">').some((i) => i.severity === "error")).toBe(true);
    expect(checkMarkdown("Plain **markdown** with [a link](https://example.com)")).toEqual([]);
  });
  it("renders Markdown without raw HTML, unsafe links or auto-loaded images", () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, null, '<script>alert(1)</script>\n\n[bad](javascript:alert(1)) [good](https://example.com)\n\n![pic](https://tracker.example/p.png)\n\n<b onclick="x">b</b>'),
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onclick");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("future player projection (not exposed in the MVP)", () => {
  it("projects nothing by default: everything seeded is GM-only", async () => {
    const { store } = await setup();
    expect(projectForPlayers(await store.getActiveState())).toEqual({ records: [], relations: [] });
  });
  it("uses an allowlist that drops prep, sources, conflicts, private assets and hidden relationships", async () => {
    const { store } = await setup();
    const state = await store.getActiveState();
    const mark = (id: string) => {
      const rs = state.records[id]!;
      rs.record = { ...rs.record!, visibility: "player_safe", demo: false } as never;
    };
    [ID.p_teruanga, ID.world, ID.ss_1, ID.m_private, ID.undertow].forEach(mark);
    const out = projectForPlayers(state);
    const text = JSON.stringify(out);
    expect(out.records.map((r) => r.id).sort()).toEqual([ID.p_teruanga, ID.world, ID.ss_1, ID.undertow].sort());
    expect(text).not.toContain("Demo preparation placeholder");
    expect(text).not.toContain("sourceRefs");
    expect(text).not.toContain("conflicts");
    expect(text).not.toContain("tide-private");
    expect(out.relations).toEqual([]); // the relationship itself is still gm_only
  });
});
