/**
 * The world's name is withheld for now. Source text keeps the real words
 * (so nothing is lost and the documents stay as written); everything shown is
 * passed through here, and each term is drawn as an unresolved glyph cipher
 * (components/tide/WorldName). Set NEXT_PUBLIC_TIDE_REVEAL_WORLD_NAME=true to
 * show the name.
 */

/** Words that would give the name away: the name, its adjective and possessives. */
export const REDACTED_TERM = /\b(Primus|Primal)(['’]s)?\b/g;

export function worldNameRevealed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_TIDE_REVEAL_WORLD_NAME === "true";
}

export type Piece = string | { redacted: string };

/** Splits text into plain runs and withheld terms. */
export function splitRedacted(text: string, reveal = worldNameRevealed()): Piece[] {
  if (reveal || !text) return [text];
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(REDACTED_TERM)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push({ redacted: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Plain-text form, for places that cannot hold markup (page titles, alt text, search). */
export function redactPlain(text: string, reveal = worldNameRevealed()): string {
  return reveal ? text : text.replace(REDACTED_TERM, "[redacted]");
}
