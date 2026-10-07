/**
 * Unicode-aware search. "Teruanga" finds "Teruānga"; "nythrok" and "Nyth'rok"
 * find "Nyth’rok". Runs server-side, only after authorization, over the active
 * release plus live print jobs and builds. GM notes are not indexed.
 */
import { recordTitle } from "./publication";
import { hrefFor } from "./queries";
import type { BuildRecord, PrintJob, PublishedState } from "./types";

export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’'‘`ʼ´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  snippet: string | null;
  href: string;
  demo: boolean;
  archived: boolean;
  score: number;
}

interface Doc {
  id: string;
  kind: string;
  title: string;
  fields: { text: string; weight: number }[];
  snippet: string | null;
  href: string;
  demo: boolean;
  archived: boolean;
}

export function buildSearchDocs(state: PublishedState, prints: PrintJob[] = [], builds: BuildRecord[] = []): Doc[] {
  const docs: Doc[] = [];
  for (const rs of Object.values(state.records)) {
    const r = rs.record;
    if (!r || rs.lifecycle === "tombstoned" || r.type === "relationship" || r.type === "source") continue;
    const href = hrefFor(rs);
    if (!href) continue;
    const fields = [{ text: recordTitle(r), weight: 10 }];
    if ("aliases" in r) (r.aliases ?? []).forEach((a) => fields.push({ text: a, weight: 8 }));
    if ("tags" in r) (r.tags ?? []).forEach((t) => fields.push({ text: t, weight: 4 }));
    if ("summary" in r && r.summary) fields.push({ text: r.summary, weight: 2 });
    if ("body" in r && r.body) fields.push({ text: r.body, weight: 1 });
    const kind = r.type === "entity" ? r.kind : r.type === "story" ? r.format : r.type === "media" ? r.mediaType : r.type;
    docs.push({ id: r.id, kind, title: recordTitle(r), fields, snippet: ("summary" in r && r.summary) || null, href, demo: r.demo, archived: rs.lifecycle === "archived" });
  }
  for (const p of prints) {
    docs.push({ id: p.id, kind: "print_job", title: p.title, fields: [{ text: p.title, weight: 10 }, { text: p.material ?? "", weight: 1 }], snippet: `Print job · ${p.status.replace("_", "-")}`, href: `/workshop/prints/${p.id}`, demo: p.demo, archived: false });
  }
  for (const b of builds) {
    docs.push({ id: b.id, kind: "build", title: b.title, fields: [{ text: b.title, weight: 10 }, { text: b.purpose ?? "", weight: 2 }], snippet: `Build · ${b.category}`, href: `/workshop/builds/${b.id}`, demo: b.demo, archived: false });
  }
  return docs;
}

export function search(docs: Doc[], query: string, limit = 50): SearchHit[] {
  const tokens = normalizeForSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const hits: SearchHit[] = [];
  for (const d of docs) {
    const normalized = d.fields.map((f) => ({ text: normalizeForSearch(f.text), compact: normalizeForSearch(f.text).replace(/ /g, ""), weight: f.weight }));
    let score = 0;
    let all = true;
    for (const t of tokens) {
      const best = normalized.reduce((m, f) => (f.text.includes(t) || f.compact.includes(t) ? Math.max(m, f.weight + (f.text.startsWith(t) ? 1 : 0)) : m), 0);
      if (!best) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) hits.push({ id: d.id, kind: d.kind, title: d.title, snippet: d.snippet, href: d.href, demo: d.demo, archived: d.archived, score: d.archived ? score / 4 : score });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/** Simple list filter used by section pages. */
export function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  const tokens = normalizeForSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const hay = fields.filter(Boolean).map((f) => normalizeForSearch(f!));
  const compact = hay.map((h) => h.replace(/ /g, ""));
  return tokens.every((t) => hay.some((h) => h.includes(t)) || compact.some((h) => h.includes(t)));
}
