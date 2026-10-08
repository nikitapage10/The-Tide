/**
 * Lore text as shown: any old working name of the world (Primus, Primal)
 * becomes Ilyr / Ilyrian. Use for titles, summaries and labels.
 */
import { renameWorld } from "@/lib/domain/world-name";

export function WorldText({ text }: { text: string | null | undefined }) {
  return text ? <>{renameWorld(text)}</> : null;
}
