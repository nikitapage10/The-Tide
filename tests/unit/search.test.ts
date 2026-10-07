import { describe, expect, it } from "vitest";
import { buildSearchDocs, matchesQuery, normalizeForSearch, search } from "@/lib/domain/search";
import { backlinksFor, relationsFor } from "@/lib/domain/queries";
import { GM, ID, setup } from "./helpers";

describe("Unicode-aware search", () => {
  it("normalizes accents, case and apostrophes", () => {
    expect(normalizeForSearch("Teruānga")).toBe("teruanga");
    expect(normalizeForSearch("Nyth’rok")).toBe("nythrok");
    expect(normalizeForSearch("NYTH'ROK")).toBe("nythrok");
  });

  it("finds peoples by plain-ASCII spellings", async () => {
    const { store } = await setup();
    const docs = buildSearchDocs(await store.getActiveState());
    expect(search(docs, "teruanga")[0]!.title).toBe("Teruānga");
    expect(search(docs, "nythrok")[0]!.title).toBe("Nyth’rok");
    expect(search(docs, "Nyth'rok")[0]!.title).toBe("Nyth’rok");
  });

  it("finds the world by its former working name through an alias", async () => {
    const { store } = await setup();
    const hits = search(buildSearchDocs(await store.getActiveState()), "primus");
    expect(hits[0]!.title).toBe("Future Earth");
  });

  it("includes live print jobs and builds but never GM notes", async () => {
    const { store, operations } = await setup();
    await operations.addGmNote({ subjectId: ID.ss_1, body: "zebracorn secret" }, GM);
    const docs = buildSearchDocs(await store.getActiveState(), await store.listPrintJobs(), await store.listBuilds());
    expect(search(docs, "terrain").map((h) => h.kind)).toContain("print_job");
    expect(search(docs, "zebracorn")).toEqual([]);
  });

  it("ranks archived records below active ones and marks them", async () => {
    const { store, publication } = await setup();
    const ex = (await import("@fixtures/publication/example-minimal.json")).default;
    await publication.publish(ex, GM);
    const hits = search(buildSearchDocs(await store.getActiveState()), "demo technology");
    expect(hits.find((h) => h.id === ID.d_tech)?.archived).toBe(true);
  });

  it("filters list text with all tokens", () => {
    expect(matchesQuery(["Teruānga", "the eight peoples"], "eight teruanga")).toBe(true);
    expect(matchesQuery(["Teruānga"], "teruanga drift")).toBe(false);
    expect(matchesQuery(["anything"], "  ")).toBe(true);
  });
});

describe("relationships", () => {
  it("are navigable in both directions with inverse labels", async () => {
    const { store } = await setup();
    const state = await store.getActiveState();
    const fromChar = relationsFor(state, ID.d_char);
    expect(fromChar).toEqual([expect.objectContaining({ label: "Member of", direction: "outgoing", other: expect.objectContaining({ id: ID.d_faction }) })]);
    const intoFaction = relationsFor(state, ID.d_faction).map((r) => [r.label, r.other.id]);
    expect(intoFaction).toEqual(expect.arrayContaining([["Has member", ID.d_char], ["Based at", ID.d_place]]));
    const world = relationsFor(state, ID.world);
    expect(world.filter((r) => r.label === "Peoples of the setting")).toHaveLength(8);
  });

  it("lists backlinks (stories and sessions that mention a record)", async () => {
    const { store } = await setup();
    const back = backlinksFor(await store.getActiveState(), ID.d_place).map((b) => b.title);
    expect(back).toEqual(expect.arrayContaining(["Demo campaign", "Demo session 1", "Demo novel"]));
  });
});
