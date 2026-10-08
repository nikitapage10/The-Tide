/**
 * The world is Ilyr (ih-LEER, /ɪˈliːr/), from the Teruānga for "light that
 * remains" (adjective: Ilyrian). Its working name in the early documents was Primus (Primal);
 * anything still carrying the old words is shown with the new ones.
 */

export const WORLD_NAME = "Ilyr";
export const WORLD_ADJECTIVE = "Ilyrian";
export const WORLD_NAME_MEANING = "light that remains";
export const WORLD_NAME_PRONUNCIATION = "ih-LEER · /ɪˈliːr/";

/** Old working names, with their possessives. */
const LEGACY = /\b(Primus|Primal)(['’]s)?\b/g;

/** Text with the world's old working names replaced by Ilyr / Ilyrian. */
export function renameWorld(text: string): string {
  return text.replace(LEGACY, (_m, word: string, poss: string | undefined) => (word === "Primus" ? WORLD_NAME : WORLD_ADJECTIVE) + (poss ?? ""));
}
