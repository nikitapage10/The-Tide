/**
 * Work orders for the C.E.O. (Command Everything, Obviously): the Tide's own
 * state, read as the jobs its agents in the Archive should pick up, instead
 * of invented ones.
 *
 *  - the Loremaster (scribe, keeper of canon): lore questions to settle,
 *    entries with no text yet, peoples without a portrait;
 *  - D20 (the GM's hands): prep still open, the next session to get ready.
 *
 * Publishing stays with the C.E.O.'s approval (`lore.publish`), which goes
 * through the Tide's own preview before anything goes live.
 */
import { hrefFor, listRecords } from "./queries";
import type { ChecklistItem, PublishedState, SessionState } from "./types";
import { imageFor, isEnclave } from "./views";
import { renameWorld } from "./world-name";

export type AgentId = "loremaster" | "d20";

export interface WorkOrder {
  /** Stable for the same job, so a repeat read doesn't duplicate it. */
  id: string;
  agent: AgentId;
  /** The C.E.O. room the job belongs to. */
  room: "archive";
  kind: "settle-question" | "write-entry" | "commission-art" | "prep-item" | "prep-session";
  title: string;
  detail: string | null;
  /** The Tide record the job is about, and its page. */
  recordId: string | null;
  href: string | null;
  priority: "high" | "normal" | "low";
}

export const ARCHIVE_AGENTS: Record<AgentId, { name: string; role: string; provider: string; catchphrase: string; bio: string }> = {
  loremaster: {
    name: "Loremaster",
    role: "Scribe",
    provider: "OpenAI (the ChatGPT spaces)",
    catchphrase: "That's provisional canon at best.",
    bio: "Keeper of the Archive and the Tide's canon. Settles questions, writes what is missing, and prepares the lore releases.",
  },
  d20: {
    name: "D20",
    role: "Game master's hands",
    provider: "Manus",
    catchphrase: "Roll for initiative!",
    bio: "The GM's many hands: session prep, encounter tables, the checklist. Loremaster's apprentice.",
  },
};

const RANK = { high: 0, normal: 1, low: 2 } as const;

export function workOrders(state: PublishedState, checklist: ChecklistItem[], sessions: SessionState[], today = new Date().toISOString().slice(0, 10)): WorkOrder[] {
  const orders: WorkOrder[] = [];
  const href = (id: string) => hrefFor(state.records[id]);

  // Lore questions to settle.
  for (const { record: q } of listRecords(state, "open_question")) {
    if (q.status !== "open") continue;
    orders.push({
      id: `settle:${q.id}`,
      agent: "loremaster",
      room: "archive",
      kind: "settle-question",
      title: `Settle: ${renameWorld(q.title)}`,
      detail: q.summary ? renameWorld(q.summary) : null,
      recordId: q.id,
      href: "/workshop#open-questions",
      priority: "high",
    });
  }

  // Entries with no text yet (the peoples first).
  for (const { record: e } of listRecords(state, "entity")) {
    if (e.body || e.demo) continue;
    const people = e.kind === "people" && !isEnclave(e);
    orders.push({
      id: `write:${e.id}`,
      agent: "loremaster",
      room: "archive",
      kind: "write-entry",
      title: people ? `Draft ${renameWorld(e.title)} origin notes` : `Write ${renameWorld(e.title)}`,
      detail: e.summary ? renameWorld(e.summary) : "No text has been supplied yet.",
      recordId: e.id,
      href: href(e.id),
      priority: people ? "high" : "normal",
    });
  }

  // Peoples without a portrait.
  for (const { record: p } of listRecords(state, "entity")) {
    if (p.kind !== "people" || isEnclave(p) || p.demo || imageFor(state, p.id)) continue;
    orders.push({
      id: `art:${p.id}`,
      agent: "loremaster",
      room: "archive",
      kind: "commission-art",
      title: `Commission a portrait of the ${renameWorld(p.title)}`,
      detail: "Brief it in the art style (docs/ART_BRIEF.md); publish it with the people's entry.",
      recordId: p.id,
      href: href(p.id),
      priority: "low",
    });
  }

  // The next session to get ready.
  const next = sessions
    .filter((s) => s.scheduledFor && s.scheduledFor >= today && !["completed", "canceled"].includes(s.status))
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!))[0];
  if (next) {
    const r = state.records[next.sessionId]?.record;
    const title = r && "title" in r && r.title ? renameWorld(r.title) : "the next session";
    orders.push({
      id: `session:${next.sessionId}`,
      agent: "d20",
      room: "archive",
      kind: "prep-session",
      title: `Prep ${title}`,
      detail: `Scheduled for ${next.scheduledFor}. Encounter table, handouts, the checklist.`,
      recordId: next.sessionId,
      href: href(next.sessionId),
      priority: "high",
    });
  }

  // Prep still open.
  for (const c of checklist) {
    if (c.done) continue;
    const subject = state.records[c.subjectId]?.record;
    orders.push({
      id: `prep:${c.id}`,
      agent: "d20",
      room: "archive",
      kind: "prep-item",
      title: c.label,
      detail: subject && "title" in subject && subject.title ? `For ${renameWorld(subject.title)}` : null,
      recordId: c.subjectId,
      href: href(c.subjectId),
      priority: "normal",
    });
  }

  return orders.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
}
