import { describe, expect, it } from "vitest";
import { workOrders } from "@/lib/domain/work-orders";
import type { ChecklistItem, PublishedState, SessionState } from "@/lib/domain/types";

const rs = (record: Record<string, unknown>) => ({ id: record.id as string, type: record.type as string, lifecycle: "active", record });
const base = { canonStatus: "provisional", visibility: "gm_only", demo: false };
const state = {
  releaseId: "r1",
  records: {
    q1: rs({ ...base, id: "q1", type: "open_question", title: "How long was the Veil?", status: "open", summary: "Seven centuries or more?" }),
    q2: rs({ ...base, id: "q2", type: "open_question", title: "Settled one", status: "resolved" }),
    syn: rs({ ...base, id: "syn", type: "entity", kind: "people", title: "Syntherion", slug: "syntherion", body: null, summary: null }),
    ter: rs({ ...base, id: "ter", type: "entity", kind: "people", title: "Teruānga", slug: "teruanga", body: "Shelled people of the deep." }),
    s2: rs({ ...base, id: "s2", type: "session", title: "Session 2", storyId: "st", sequence: 2 }),
  },
} as unknown as PublishedState;
const checklist = [
  { id: "c1", subjectId: "s2", label: "Print the encounter table", done: false },
  { id: "c2", subjectId: "s2", label: "Done already", done: true },
] as ChecklistItem[];
const sessions = [{ sessionId: "s2", status: "planned", scheduledFor: "2026-10-20" }] as SessionState[];

describe("work orders for the C.E.O.'s Archive", () => {
  const orders = workOrders(state, checklist, sessions, "2026-10-10");
  const ids = orders.map((o) => o.id);

  it("turns open questions, unwritten peoples, missing portraits, the next session and open prep into jobs", () => {
    expect(ids).toEqual(expect.arrayContaining(["settle:q1", "write:syn", "art:syn", "art:ter", "session:s2", "prep:c1"]));
    expect(ids).not.toContain("settle:q2");
    expect(ids).not.toContain("prep:c2");
    expect(ids).not.toContain("write:ter");
  });

  it("gives lore to the Loremaster and prep to D20, most urgent first", () => {
    expect(orders.find((o) => o.id === "write:syn")).toMatchObject({ agent: "loremaster", title: "Draft Syntherion origin notes", priority: "high" });
    expect(orders.find((o) => o.id === "prep:c1")).toMatchObject({ agent: "d20", title: "Print the encounter table", detail: "For Session 2" });
    expect(orders.find((o) => o.id === "session:s2")).toMatchObject({ agent: "d20", title: "Prep Session 2" });
    const rank = { high: 0, normal: 1, low: 2 };
    for (let i = 1; i < orders.length; i++) expect(rank[orders[i]!.priority]).toBeGreaterThanOrEqual(rank[orders[i - 1]!.priority]);
  });

  it("leaves past sessions alone", () => {
    expect(workOrders(state, [], sessions, "2026-11-01").some((o) => o.kind === "prep-session")).toBe(false);
  });
});
