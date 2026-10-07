/**
 * Abstract, deterministic placeholder art generated from a stable ID.
 * Decorative only — never presented as a map, species or canonical artwork.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function ProceduralMark({ seed, size = 56, className }: { seed: string; size?: number; className?: string }) {
  const h = hash(seed);
  const cx = 35 + (h % 30);
  const cy = 35 + ((h >> 8) % 30);
  const rings = 4 + ((h >> 16) % 4);
  const skew = 0.6 + ((h >> 20) % 40) / 100;
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 100 100" className={className}>
      <rect width="100" height="100" rx="12" fill="var(--surface-3)" />
      {Array.from({ length: rings }, (_, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={6 + i * 8} ry={(6 + i * 8) * skew} fill="none" stroke="var(--accent)" strokeOpacity={0.85 - i * 0.09} strokeWidth="1.6" />
      ))}
      <line x1="0" y1={(h >> 4) % 100} x2="100" y2={(h >> 12) % 100} stroke="var(--accent-2)" strokeOpacity="0.4" strokeWidth="1.2" />
    </svg>
  );
}
