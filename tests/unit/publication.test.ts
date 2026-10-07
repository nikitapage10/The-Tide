import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import { GM, ID, PROJECT, SEED_RELEASE, exampleBundle, setup, uuid } from "./helpers";

const ACTOR = GM;

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof DomainError && e.code === code);
}

describe("preview", () => {
  it("never mutates any stored data", async () => {
    const { store, publication } = await setup();
    const before = JSON.stringify(store.snapshotDoc());
    const preview = await publication.preview(exampleBundle());
    expect(preview.ok).toBe(true);
    expect(preview.counts).toMatchObject({ added: 1, changed: 1, archived: 1 });
    expect(JSON.stringify(store.snapshotDoc())).toBe(before);
  });

  it("reports changed fields, relationship changes and source gaps", async () => {
    const { publication } = await setup();
    const b = exampleBundle();
    b.operations.push({ op: "archive", targetId: ID.rel_d_member, reason: null } as never);
    const p = await publication.preview(b);
    expect(p.changes.find((c) => c.id === ID.d_faction)?.changedFields).toEqual(["title"]);
    expect(p.relationshipChanges.map((c) => c.change)).toEqual(["archived"]);
    const realRecord = { op: "upsert", record: { type: "entity", id: uuid(), title: "Unsourced", kind: "concept", canonStatus: "provisional", demo: false } };
    b.operations.push(realRecord as never);
    const p2 = await publication.preview(b);
    expect(p2.sourceGaps.map((g) => g.title)).toContain("Unsourced");
  });

  it("flags an exact retry of a published bundle instead of calling it stale", async () => {
    const { publication } = await setup();
    await publication.publish(exampleBundle(), ACTOR);
    const p = await publication.preview(exampleBundle());
    expect(p.issues[0]!.code).toBe("ALREADY_APPLIED");
  });
});

describe("publish", () => {
  it("applies a valid bundle as a new version and records an audit event", async () => {
    const { store, publication } = await setup();
    const r = await publication.publish(exampleBundle(), ACTOR);
    expect(r.status).toBe("applied");
    expect(r.release.version).toBe(2);
    expect(r.release.baseReleaseId).toBe(SEED_RELEASE);
    expect(r.release.publishedBy).toEqual(ACTOR);
    expect(Date.parse(r.release.publishedAt)).not.toBeNaN();
    const state = await store.getActiveState();
    expect(state.releaseId).toBe(r.release.id);
    expect(state.records[ID.d_tech]!.lifecycle).toBe("archived");
    const events = await store.listPublicationEvents(5);
    expect(events[0]).toMatchObject({ outcome: "applied", releaseId: r.release.id });
  });

  it("is idempotent: the same release ID and content return the original result", async () => {
    const { store, publication } = await setup();
    const first = await publication.publish(exampleBundle(), ACTOR);
    const again = await publication.publish(exampleBundle(), ACTOR);
    expect(again.status).toBe("replayed");
    expect(again.release).toEqual(first.release);
    expect((await store.listReleases()).length).toBe(2);
  });

  it("rejects reuse of a release ID with different content", async () => {
    const { publication } = await setup();
    await publication.publish(exampleBundle(), ACTOR);
    const changed = exampleBundle();
    changed.title = "Different content";
    await expectCode(publication.publish(changed, ACTOR), "RELEASE_ID_CONFLICT");
  });

  it("rejects a stale base release with a clear conflict", async () => {
    const { store, publication } = await setup();
    await publication.publish(exampleBundle(), ACTOR);
    const stale = exampleBundle();
    stale.releaseId = uuid();
    await expectCode(publication.publish(stale, ACTOR), "STALE_BASE");
    expect((await store.getProject()).releaseCount).toBe(2);
  });

  it("does not publish anything when the commit fails part-way (transactional)", async () => {
    let fail = false;
    const { store, publication } = await setup({
      fault: (stage) => {
        if (fail && stage === "commit:before-activate") throw new Error("simulated storage failure");
      },
    });
    const before = JSON.stringify(store.snapshotDoc());
    fail = true;
    await expect(publication.publish(exampleBundle(), ACTOR)).rejects.toThrow("simulated storage failure");
    const project = await store.getProject();
    expect(project.activeReleaseId).toBe(SEED_RELEASE);
    expect(await store.getRelease(exampleBundle().releaseId)).toBeNull();
    const after = store.snapshotDoc();
    expect(JSON.stringify({ ...after, publicationEvents: [] })).toBe(JSON.stringify({ ...JSON.parse(before), publicationEvents: [] }));
  });

  it("never deletes records that are merely omitted from a bundle", async () => {
    const { store, publication } = await setup();
    const before = Object.keys((await store.getActiveState()).records).length;
    await publication.publish(exampleBundle(), ACTOR);
    const state = await store.getActiveState();
    expect(Object.keys(state.records).length).toBe(before + 1);
    expect(state.records[ID.p_teruanga]!.lifecycle).toBe("active");
  });

  it("requires explicit confirmation for tombstones and retires the identity", async () => {
    const { store, publication } = await setup();
    const b = exampleBundle();
    b.operations = [{ op: "tombstone", targetId: ID.d_creature, confirmTargetId: ID.d_creature, reason: "Demo removal" }] as never;
    // d_creature is referenced by demo stories/sessions; references must be removed first.
    const refused = await publication.preview(b);
    expect(refused.issues.map((i) => i.code)).toContain("INVALID_REFERENCE");

    const b2 = exampleBundle();
    b2.operations = [{ op: "tombstone", targetId: ID.d_event, confirmTargetId: ID.d_event, reason: "Demo removal" }] as never;
    await publication.publish(b2, ACTOR);
    const rs = (await store.getActiveState()).records[ID.d_event]!;
    expect(rs.lifecycle).toBe("tombstoned");
    expect(rs.record).toBeNull();
    expect(rs.tombstone?.lastTitle).toBe("Demo event with unknown date");

    const revive = exampleBundle();
    revive.releaseId = uuid();
    revive.baseReleaseId = b2.releaseId;
    revive.operations = [{ op: "upsert", record: { type: "entity", id: ID.d_event, title: "Back", kind: "event", canonStatus: "non_canon", demo: true } }] as never;
    const p = await publication.preview(revive);
    expect(p.issues.map((i) => i.code)).toContain("IDENTITY_RETIRED");
  });

  it("rejects changing a record's type for an existing ID", async () => {
    const { publication } = await setup();
    const b = exampleBundle();
    b.operations = [{ op: "upsert", record: { type: "story", id: ID.p_teruanga, title: "X", format: "novel", canonStatus: "non_canon", demo: true } }] as never;
    const p = await publication.preview(b);
    expect(p.issues.map((i) => i.code)).toContain("TYPE_MISMATCH");
  });
});

describe("stable identity and live work", () => {
  it("a title change keeps the same ID, references and existing live work", async () => {
    const { store, publication, operations } = await setup();
    const note = await operations.addGmNote({ subjectId: ID.ss_1, body: "Keep me" }, ACTOR);
    const jobsBefore = await store.listPrintJobs();

    const b = exampleBundle();
    const seedSession = (await store.getActiveState()).records[ID.ss_1]!.record!;
    b.operations = [{ op: "upsert", record: { ...seedSession, title: "Demo session 1 (renamed)" } }] as never;
    await publication.publish(b, ACTOR);

    const state = await store.getActiveState();
    expect(Object.values(state.records).filter((r) => r.record && "title" in r.record && r.record.title?.startsWith("Demo session 1"))).toHaveLength(1);
    expect(state.records[ID.ss_1]!.record).toMatchObject({ title: "Demo session 1 (renamed)" });
    expect((await store.listGmNotes(ID.ss_1)).map((n) => n.id)).toContain(note.id);
    expect(await store.listChecklistItems(ID.ss_1)).toHaveLength(3);
    expect(await store.listPrintJobs()).toEqual(jobsBefore);
  });

  it("archiving keeps live references resolvable", async () => {
    const { store, publication } = await setup();
    const b = exampleBundle();
    b.operations = [{ op: "archive", targetId: ID.ss_1, reason: "done" }] as never;
    await publication.publish(b, ACTOR);
    const state = await store.getActiveState();
    expect(state.records[ID.ss_1]!.lifecycle).toBe("archived");
    expect(state.records[ID.ss_1]!.record).not.toBeNull();
    const terrain = (await store.listPrintJobs()).find((p) => p.id === ID.pj_terrain)!;
    expect(terrain.linkedRecordIds).toContain(ID.ss_1);
  });
});

describe("rollback", () => {
  it("restores lore as a new, higher version and leaves newer live changes intact", async () => {
    const { store, publication, operations } = await setup();
    const applied = await publication.publish(exampleBundle(), ACTOR);

    // Live changes made after the release we will roll back from.
    const item = (await store.listChecklistItems(ID.ss_1)).find((c) => !c.done)!;
    await operations.updateChecklistItem(item.id, { expectedRevision: item.revision, done: true }, ACTOR);
    const job = (await store.getPrintJob(ID.pj_terrain))!;
    await operations.recordPrintAttempt(job.id, { expectedRevision: job.revision, outcome: "succeeded", quantity: 2 }, ACTOR);
    await operations.updateSessionState(ID.ss_1, { expectedRevision: 0, status: "completed", actualRunDate: "2026-10-01" }, ACTOR);
    const liveBefore = JSON.stringify({ c: await store.listChecklistItems(), p: await store.listPrintJobs(), s: await store.listSessionStates(), n: await store.listGmNotes() });

    const rb = await publication.rollback({ releaseId: uuid(), targetReleaseId: SEED_RELEASE, expectedActiveReleaseId: applied.release.id }, ACTOR);
    expect(rb.status).toBe("applied");
    expect(rb.release.kind).toBe("rollback");
    expect(rb.release.version).toBe(3);
    expect(rb.release.rollbackOfReleaseId).toBe(SEED_RELEASE);

    const state = await store.getActiveState();
    expect(state.records[ID.d_faction]!.record).toMatchObject({ title: "Demo faction" });
    expect(state.records[ID.d_tech]!.lifecycle).toBe("active");
    // Added after the target: archived, not deleted.
    expect(state.records[ID.d_relic]!.lifecycle).toBe("archived");

    const liveAfter = JSON.stringify({ c: await store.listChecklistItems(), p: await store.listPrintJobs(), s: await store.listSessionStates(), n: await store.listGmNotes() });
    expect(liveAfter).toBe(liveBefore);
  });

  it("is idempotent per rollback release ID and refuses a stale active release", async () => {
    const { publication } = await setup();
    const applied = await publication.publish(exampleBundle(), ACTOR);
    const id = uuid();
    const first = await publication.rollback({ releaseId: id, targetReleaseId: SEED_RELEASE, expectedActiveReleaseId: applied.release.id }, ACTOR);
    const again = await publication.rollback({ releaseId: id, targetReleaseId: SEED_RELEASE, expectedActiveReleaseId: applied.release.id }, ACTOR);
    expect(again.status).toBe("replayed");
    expect(again.release.version).toBe(first.release.version);
    await expectCode(publication.rollback({ releaseId: uuid(), targetReleaseId: SEED_RELEASE, expectedActiveReleaseId: applied.release.id }, ACTOR), "STALE_BASE");
  });

  it("keeps tombstoned identities retired", async () => {
    const { store, publication } = await setup();
    const b = exampleBundle();
    b.operations = [{ op: "tombstone", targetId: ID.d_event, confirmTargetId: ID.d_event, reason: "gone" }] as never;
    const applied = await publication.publish(b, ACTOR);
    await publication.rollback({ releaseId: uuid(), targetReleaseId: SEED_RELEASE, expectedActiveReleaseId: applied.release.id }, ACTOR);
    expect((await store.getActiveState()).records[ID.d_event]!.lifecycle).toBe("tombstoned");
  });

  it("rejects a target release from nowhere", async () => {
    const { publication } = await setup();
    await expectCode(publication.rollback({ releaseId: uuid(), targetReleaseId: uuid(), expectedActiveReleaseId: SEED_RELEASE }, ACTOR), "NOT_FOUND");
  });
});

describe("project scoping", () => {
  it("a service for another project refuses this project's bundles", async () => {
    const { store } = await setup();
    const { PublicationService } = await import("@/lib/domain/publication");
    const other = new PublicationService(store, uuid());
    await expectCode(other.publish(exampleBundle(), ACTOR), "CROSS_PROJECT");
    expect(PROJECT).not.toBe(uuid());
  });
});
