/** A live site without the lore from the GM's documents publishes it by itself, once. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GM, PROJECT, setup } from "./helpers";

vi.mock("server-only", () => ({}));

describe("automatic lore publication", () => {
  beforeEach(() => vi.resetModules());

  it("publishes the lore once on a site that lacks it, then leaves it alone", async () => {
    const { store } = await setup();
    const { wireContext } = await import("@/lib/server/context");
    const { ensureLore, loreMissing, resetAutoLore } = await import("@/lib/server/auto-lore");
    resetAutoLore();
    const ctx = wireContext("supabase", PROJECT, GM, store);
    expect(loreMissing(await store.getActiveState())).toBe(true);
    await ensureLore(ctx);
    const after = await store.getActiveState();
    expect(loreMissing(after)).toBe(false);
    expect(after.version).toBe(2);
    await ensureLore(ctx);
    expect((await store.getActiveState()).version).toBe(2);
  });

  it("publishes as the very first release on a site with nothing published", async () => {
    const { MemoryStore, emptyDoc } = await import("@/lib/data/memory-store");
    const store = new MemoryStore(emptyDoc({ id: PROJECT, name: "The Tide" }));
    const { wireContext } = await import("@/lib/server/context");
    const { ensureLore, loreMissing, resetAutoLore } = await import("@/lib/server/auto-lore");
    resetAutoLore();
    await ensureLore(wireContext("supabase", PROJECT, GM, store));
    const after = await store.getActiveState();
    expect(after.version).toBe(1);
    expect(loreMissing(after)).toBe(false);
  });

  it("does nothing for visitors who cannot publish, or in demo mode", async () => {
    const { store } = await setup();
    const { wireContext } = await import("@/lib/server/context");
    const { ensureLore, resetAutoLore } = await import("@/lib/server/auto-lore");
    resetAutoLore();
    await ensureLore(wireContext("supabase", PROJECT, { kind: "user", id: "public", label: "Visitor" }, store, null, false));
    await ensureLore(wireContext("demo", PROJECT, GM, store));
    expect((await store.getActiveState()).version).toBe(1);
  });
});
