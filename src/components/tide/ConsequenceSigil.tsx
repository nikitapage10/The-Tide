/**
 * The marks of the Three Consequences: the Drowning (a world sinking below
 * its horizon), the Divergence (two arcs parting from one axis) and the Drift
 * (a broken ring, a fragment arriving). Drawn as thin luminous line sigils
 * (art sheet 1).
 */
import { ArtSigil } from "./ArtSigil";
import { consequenceSigil } from "@/lib/art";

export type Consequence = "drowning" | "divergence" | "drift";

export function ConsequenceSigil({ kind, size = 28, className = "" }: { kind: Consequence; size?: number; className?: string }) {
  return <ArtSigil src={consequenceSigil(kind)} size={size} className={`sigil sigil-${kind} ${className}`} />;
}
