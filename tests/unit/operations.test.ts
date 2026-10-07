import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import { LIVE_OWNED_FIELDS, SOURCE_OWNED_FIELDS } from "@/lib/domain/operations";
import { GM, ID, setup } from "./helpers";

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof DomainError ? e.code : `THROWN:${String(e)}`;
  }
}

describe("field ownership", () => {
  it("live-owned session fields never overlap source-owned session fields", () => {
    const overlap = LIVE_OWNED_FIELDS.session_state.filter((f) => SOURCE_OWNED_FIELDS.session!.includes(f));
    expect(overlap).toEqual([]);
  });

  it("rejects attempts to change source-owned fields through live endpoints", async () => {
    const { operations, store } = await setup();
    const before = JSON.stringify(await store.getActiveState());
    for (const field of ["title", "prep", "recap", "storyId", "canonStatus"]) {
      const err = await operations.updateSessionState(ID.ss_1, { expectedRevision: 0, [field]: "x" }, GM).catch((e) => e);
      expect(err).toBeInstanceOf(DomainError);
      expect(err.code).toBe("FIELD_NOT_ALLOWED");
      expect(err.message).toMatch(/source-owned/);
    }
    expect(JSON.stringify(await store.getActiveState())).toBe(before);
  });

  it("rejects unknown and identity fields on print jobs", async () => {
    const { operations } = await setup();
    const job = (await operations["store"].getPrintJob(ID.pj_terrain))!;
    expect(await code(operations.updatePrintJob(job.id, { expectedRevision: job.revision, projectId: "x" }, GM))).toBe("FIELD_NOT_ALLOWED");
    expect(await code(operations.updatePrintJob(job.id, { expectedRevision: job.revision, demo: false }, GM))).toBe("FIELD_NOT_ALLOWED");
  });
});

describe("session state", () => {
  it("creates on first write, then requires the current revision", async () => {
    const { operations } = await setup();
    const s1 = await operations.updateSessionState(ID.ss_1, { expectedRevision: 0, status: "scheduled", scheduledFor: "2026-11-02" }, GM);
    expect(s1.revision).toBe(1);
    expect(await code(operations.updateSessionState(ID.ss_1, { expectedRevision: 0, status: "canceled" }, GM))).toBe("REVISION_CONFLICT");
    const s2 = await operations.updateSessionState(ID.ss_1, { expectedRevision: 1, status: "in_progress" }, GM);
    expect(s2).toMatchObject({ revision: 2, status: "in_progress", scheduledFor: "2026-11-02" });
  });
  it("validates dates and session IDs", async () => {
    const { operations } = await setup();
    expect(await code(operations.updateSessionState(ID.ss_1, { expectedRevision: 0, scheduledFor: "2026-02-30" }, GM))).toBe("INVALID_INPUT");
    expect(await code(operations.updateSessionState(ID.p_teruanga, { expectedRevision: 0, status: "planned" }, GM))).toBe("INVALID_INPUT");
  });
});

describe("checklist", () => {
  it("creates, completes, renames and deletes with revision checks", async () => {
    const { operations, store } = await setup();
    const item = await operations.createChecklistItem({ subjectId: ID.ss_2, label: "Print minis" }, GM);
    const done = await operations.updateChecklistItem(item.id, { expectedRevision: 1, done: true }, GM);
    expect(done).toMatchObject({ done: true, revision: 2 });
    expect(await code(operations.updateChecklistItem(item.id, { expectedRevision: 1, label: "stale" }, GM))).toBe("REVISION_CONFLICT");
    await operations.deleteChecklistItem(item.id, { expectedRevision: 2 }, GM);
    expect(await store.getChecklistItem(item.id)).toBeNull();
  });
  it("only allows sessions or stories as subjects", async () => {
    const { operations } = await setup();
    expect(await code(operations.createChecklistItem({ subjectId: ID.p_teruanga, label: "x" }, GM))).toBe("INVALID_INPUT");
  });
});

describe("GM notes", () => {
  it("never copies note text into the activity log", async () => {
    const { operations, store } = await setup();
    await operations.addGmNote({ subjectId: ID.ss_1, body: "SECRET-PLOT-TWIST" }, GM);
    const activity = await store.listActivity(10);
    expect(JSON.stringify(activity)).not.toContain("SECRET-PLOT-TWIST");
  });
});

describe("print jobs", () => {
  const base = { title: "Terrain tiles", requestedQuantity: 4 };

  it("validates quantities with actionable messages", async () => {
    const { operations } = await setup();
    const zero = await operations.createPrintJob({ ...base, requestedQuantity: 0 }, GM).catch((e) => e);
    expect(zero.details.fieldErrors.requestedQuantity).toMatch(/at least 1/);
    const frac = await operations.createPrintJob({ ...base, requestedQuantity: 1.5 }, GM).catch((e) => e);
    expect(frac.details.fieldErrors.requestedQuantity).toMatch(/whole number/);
    const over = await operations.createPrintJob({ ...base, completedQuantity: 5 }, GM).catch((e) => e);
    expect(over.details.fieldErrors.completedQuantity).toMatch(/can't exceed requested/);
    const early = await operations.createPrintJob({ ...base, completedQuantity: 3, status: "complete" }, GM).catch((e) => e);
    expect(early.details.fieldErrors.status).toMatch(/1 piece is still outstanding/);
  });

  it("rejects unsafe source links and unknown linked records", async () => {
    const { operations } = await setup();
    expect(await code(operations.createPrintJob({ ...base, sourceUrl: "javascript:alert(1)" }, GM))).toBe("INVALID_INPUT");
    expect(await code(operations.createPrintJob({ ...base, linkedRecordIds: ["00000000-0000-4000-8000-00000000dead"] }, GM))).toBe("INVALID_INPUT");
  });

  it("records reprints as attempts without changing the requested quantity", async () => {
    const { operations, store } = await setup();
    const job = await operations.createPrintJob({ ...base, linkedRecordIds: [ID.ss_1] }, GM);
    const failed = await operations.recordPrintAttempt(job.id, { expectedRevision: 1, outcome: "failed", quantity: 2, note: "warped" }, GM);
    expect(failed).toMatchObject({ requestedQuantity: 4, completedQuantity: 0, failedQuantity: 2 });
    const ok = await operations.recordPrintAttempt(job.id, { expectedRevision: 2, outcome: "succeeded", quantity: 4 }, GM);
    expect(ok).toMatchObject({ requestedQuantity: 4, completedQuantity: 4, failedQuantity: 2 });
    const extra = await operations.recordPrintAttempt(job.id, { expectedRevision: 3, outcome: "succeeded", quantity: 1 }, GM).catch((e) => e);
    expect(extra.details.fieldErrors.quantity).toMatch(/Raise the requested quantity/);
    expect(await store.listPrintAttempts(job.id)).toHaveLength(2);
  });

  it("detects conflicting edits", async () => {
    const { operations } = await setup();
    const job = await operations.createPrintJob(base, GM);
    await operations.updatePrintJob(job.id, { expectedRevision: 1, status: "printing" }, GM);
    expect(await code(operations.updatePrintJob(job.id, { expectedRevision: 1, notes: "lost" }, GM))).toBe("REVISION_CONFLICT");
  });

  it("does not partially apply an attempt when storage fails mid-write", async () => {
    let fail = false;
    const { operations, store } = await setup({ fault: (s) => { if (fail && s === "print-attempt") throw new Error("disk full"); } });
    const job = await operations.createPrintJob(base, GM);
    fail = true;
    await expect(operations.recordPrintAttempt(job.id, { expectedRevision: 1, outcome: "succeeded", quantity: 1 }, GM)).rejects.toThrow("disk full");
    expect((await store.getPrintJob(job.id))!.completedQuantity).toBe(0);
    expect(await store.listPrintAttempts(job.id)).toHaveLength(0);
  });
});

describe("builds", () => {
  it("creates, edits and versions a build", async () => {
    const { operations } = await setup();
    const b = await operations.createBuild({ title: "Shelf", category: "physical", links: [{ label: "Plan", url: "https://example.com/plan" }] }, GM);
    const v = await operations.addBuildVersion(b.id, { expectedRevision: 1, label: "v1" }, GM);
    expect(v.versions).toHaveLength(1);
    expect(await code(operations.updateBuild(b.id, { expectedRevision: 1, title: "stale" }, GM))).toBe("REVISION_CONFLICT");
    expect(await code(operations.createBuild({ title: "x", category: "code", links: [{ label: "bad", url: "data:text/html,hi" }] }, GM))).toBe("INVALID_INPUT");
  });
});
