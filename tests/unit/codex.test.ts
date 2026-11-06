import { describe, it, expect } from "vitest";
import { filterForAudience } from "@/lib/domain/audience";
import { homePeoples } from "@/lib/domain/views";
import {
  workingDrafts,
  draftSubject,
  draftVersions,
  writeDraft,
  draftComments,
} from "@/lib/domain/drafts";
import { readOnlyStore } from "@/lib/data/read-only-store";
import { GM, setup, uuid, clone } from "./helpers";
import lore from "@fixtures/publication/lore-release.json";
describe("readers and the unchanged home presentation", () => {
  it("shows nine public introductions without full origin text, retaining the original eight home slots", async () => {
    const { store, publication } = await setup();
    await publication.publish(clone(lore), GM);
    const full = await store.getActiveState(),
      reader = filterForAudience(full, "public");
    const peoples = Object.values(reader.records).filter(
      (s) =>
        s.record?.type === "entity" &&
        s.record.kind === "people" &&
        !s.record.tags?.includes("enclave"),
    );
    expect(peoples).toHaveLength(9);
    expect(
      peoples.every((s) => s.record && "body" in s.record && !s.record.body),
    ).toBe(true);
    expect(homePeoples(full).map((x) => x.record.title)).toEqual(
      homePeoples(reader).map((x) => x.record.title),
    );
    expect(homePeoples(full)).toHaveLength(8);
    expect(JSON.stringify(reader)).not.toContain("sourceRefs");
  });
});
describe("private drafts use the existing GM-only store", () => {
  it("keeps recoverable revisions and comments without publishing draft text", async () => {
    const { store, operations, publication } = await setup();
    await publication.publish(clone(lore), GM);
    const state = await store.getActiveState(),
      base = await store.getActiveState();
    const record = {
      id: uuid(),
      type: "entity",
      kind: "place",
      title: "A possible settlement",
      summary: "Proposed, not established.",
      body: "SECRET UNFINISHED SCENE",
      visibility: "gm_only",
      canonStatus: "unverified",
      demo: false,
      tags: ["working draft"],
    } as const;
    const ctx = { state, store, operations, actor: GM };
    const first = await writeDraft(
      { action: "save", record, parentVersionId: null },
      ctx,
    );
    expect("versionId" in first).toBe(true);
    const versionId = "versionId" in first ? first.versionId : null;
    await writeDraft(
      {
        action: "save",
        record: { ...record, body: "Second revision" },
        parentVersionId: versionId,
      },
      ctx,
    );
    await expect(
      writeDraft({ action: "save", record, parentVersionId: versionId }, ctx),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await writeDraft(
      {
        action: "comment",
        draftId: record.id,
        body: "Try a different opening.",
      },
      ctx,
    );
    const notes = await store.listGmNotes(draftSubject(state));
    expect(draftVersions(notes)).toHaveLength(2);
    expect(
      workingDrafts(state, notes).find((d) => d.id === record.id)?.body,
    ).toBe("Second revision");
    expect(draftComments(notes, record.id)[0]?.body).toBe(
      "Try a different opening.",
    );
    expect(await store.getActiveState()).toEqual(base);
    expect(JSON.stringify(await store.listActivity(20))).not.toContain(
      "SECRET UNFINISHED SCENE",
    );
    expect(await readOnlyStore(store, "public").listGmNotes()).toEqual([]);
  });
  it("rejects source-entry overwrites and public draft payloads", async () => {
    const { store, operations, publication } = await setup();
    await publication.publish(clone(lore), GM);
    const state = await store.getActiveState();
    const source = Object.values(state.records).find(
      (r) => r.record?.type === "entity",
    )!.record!;
    await expect(
      writeDraft(
        {
          action: "save",
          record: {
            ...source,
            visibility: "gm_only",
            canonStatus: "unverified",
            tags: ["working draft"],
          },
          parentVersionId: null,
        },
        { state, store, operations, actor: GM },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
