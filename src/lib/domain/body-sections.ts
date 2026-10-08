/**
 * Long entries are written in the documents' template: "##" headings for the
 * main sections (Origins, the Age of the Veil, the Three Consequences, Today,
 * Anatomy, Behavior, Unique Abilities, Reproduction, Habitat). This splits a
 * body into its opening and those sections, each with a short rail label, so
 * a page can lay them out and build a table of contents.
 */

export interface BodySection {
  id: string;
  /** The heading as written. */
  title: string;
  /** A short label for the rail ("Origins", "The Veil", ...). */
  label: string;
  /** Which template section this is, when recognised. */
  key: TemplateKey | null;
  markdown: string;
}

export type TemplateKey = "origins" | "veil" | "verdancy" | "consequences" | "today" | "anatomy" | "behavior" | "abilities" | "reproduction" | "habitat" | "about" | "history";

const TEMPLATE: [TemplateKey, RegExp, string][] = [
  ["origins", /^origins\b/i, "Origins"],
  ["veil", /age of the (abyssal )?veil/i, "The Veil"],
  ["verdancy", /verdancy|return to/i, "Verdancy"],
  ["consequences", /three consequences/i, "The Tide"],
  ["today", /\btoday\b/i, "Today"],
  ["anatomy", /^anatomy$/i, "Anatomy"],
  ["behavior", /^behaviou?r$/i, "Behaviour"],
  ["abilities", /abilities/i, "Abilities"],
  ["reproduction", /^reproduction$/i, "Reproduction"],
  ["habitat", /^habitat$/i, "Habitat"],
  ["about", /^about$/i, "About"],
  ["history", /^history$/i, "History"],
];

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function splitBody(body: string | null | undefined): { intro: string; sections: BodySection[] } {
  const text = body ?? "";
  const lines = text.split("\n");
  const intro: string[] = [];
  const sections: BodySection[] = [];
  const used = new Set<string>();
  let cur: { title: string; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const match = TEMPLATE.find(([, re]) => re.test(cur!.title));
    let id = slug(cur.title) || "section";
    while (used.has(id)) id += "-2";
    used.add(id);
    // Two "today" sections exist in some drafts; the second is labelled by its own title.
    const key = match && !sections.some((s) => s.key === match[0]) ? match[0] : null;
    sections.push({ id, title: cur.title, label: key ? match![2] : cur.title, key, markdown: cur.lines.join("\n").trim() });
  };
  for (const line of lines) {
    const m = line.match(/^## (.+?)\s*$/);
    if (m) {
      flush();
      cur = { title: m[1]!.replace(/:$/, ""), lines: [] };
    } else if (cur) cur.lines.push(line);
    else intro.push(line);
  }
  flush();
  return { intro: intro.join("\n").trim(), sections };
}
