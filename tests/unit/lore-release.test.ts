/**
 * The lore release built from the GM's documents (scripts/build-lore-bundle.ts)
 * publishes cleanly on top of the seed release.
 */
import lore from "@fixtures/publication/lore-release.json";
import { describe, expect, it } from "vitest";
import { GM, clone, setup } from "./helpers";

describe("lore release", () => {
  it("validates without errors and publishes on the seed", async () => {
    const { publication, store } = await setup();
    const preview = await publication.preview(clone(lore));
    const errors = preview.issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
    const result = await publication.publish(clone(lore), GM);
    expect(result.status).toBe("applied");
    const state = await store.getActiveState();
    const teruanga = Object.values(state.records).find((r) => r.record?.type === "entity" && r.record.title === "Teruānga")?.record;
    expect(teruanga && "body" in teruanga ? teruanga.body : "").toMatch(/## Anatomy/);
  });

  it("keeps the first release's peoples (no duplicates)", async () => {
    const { publication, store } = await setup();
    await publication.publish(clone(lore), GM);
    const state = await store.getActiveState();
    const peoples = Object.values(state.records).filter((r) => r.record?.type === "entity" && r.record.kind === "people" && !r.record.tags?.includes("enclave"));
    expect(peoples).toHaveLength(8);
  });
});
