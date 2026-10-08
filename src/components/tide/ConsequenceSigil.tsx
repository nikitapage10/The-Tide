/**
 * The marks of the Three Consequences, drawn from the hero's own effects:
 * the Drowning as rising swell lines, the Divergence as a lens and its ring,
 * the Drift as offset fragments arriving.
 */
export type Consequence = "drowning" | "divergence" | "drift";

export function ConsequenceSigil({ kind, size = 28, className = "" }: { kind: Consequence; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true" className={`sigil sigil-${kind} ${className}`}>
      {kind === "drowning" ? (
        <>
          <path d="M3 13c3-2 5-2 8 0s5 2 8 0 5-2 8 0" />
          <path d="M3 18c3-2 5-2 8 0s5 2 8 0 5-2 8 0" opacity="0.7" />
          <path d="M3 23c3-2 5-2 8 0s5 2 8 0 5-2 8 0" opacity="0.4" />
          <path d="M10 8l6-4 6 4" opacity="0.6" />
        </>
      ) : kind === "divergence" ? (
        <>
          <circle cx="16" cy="16" r="3.2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="7" opacity="0.8" />
          <circle cx="16" cy="16" r="12" opacity="0.35" strokeDasharray="2 3" />
        </>
      ) : (
        <>
          <path d="M4 10h9" opacity="0.4" />
          <path d="M9 16h14" opacity="0.7" />
          <path d="M15 22h13" />
          <rect x="24" y="8.5" width="3" height="3" opacity="0.5" />
          <rect x="4" y="20.5" width="3" height="3" />
        </>
      )}
    </svg>
  );
}
