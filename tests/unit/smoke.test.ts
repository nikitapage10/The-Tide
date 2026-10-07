import { describe, expect, it } from "vitest";
import { createSeededMemoryStore } from "@/lib/data/demo-seed";

describe("seed", () => {
  it("publishes the seed bundle", async () => {
    const store = await createSeededMemoryStore();
    const state = await store.getActiveState();
    expect(state.version).toBe(1);
    expect(Object.keys(state.records).length).toBeGreaterThan(40);
  });
});
