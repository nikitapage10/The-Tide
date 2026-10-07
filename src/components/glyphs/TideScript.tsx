/**
 * The Tide's script: one glyph per letter / digit (a real cipher, so the same
 * letter always reads the same).
 *
 * STAND-IN: until the supplied alphabet artwork is traced, each glyph is drawn
 * procedurally in the mark's language (a meridian, beads, a ring, diamond or
 * crescent). Swapping in the real alphabet only changes this file: replace
 * `glyphParts` with the traced paths per character.
 */

/** Characters the script has glyphs for; anything else is shown as itself. */
export function hasGlyph(ch: string) {
  return /^[A-Za-z0-9]$/.test(ch);
}

const hash = (c: number, k: number) => (((c * 2654435761) ^ (k * 40503 + 0x9e3779b9)) >>> 0) % 1000 / 1000;

function glyphParts(ch: string) {
  const c = ch.toUpperCase().charCodeAt(0);
  const h = (k: number) => hash(c, k);
  // viewBox 0 0 12 20; meridian at x = 6.
  const top = 1.5 + h(1) * 2.5;
  const bottom = 18.5 - h(2) * 2.5;
  const cy = 7 + h(3) * 6;
  const shape = Math.floor(h(4) * 5);
  const r = 2.2 + h(5) * 1.4;
  const beadMid = h(6) < 0.5;
  const bar = h(7) < 0.45 ? 3.5 + h(8) * 3 : 0;
  const crescent = h(9) < 0.4;
  return { top, bottom, cy, shape, r, beadMid, bar, crescent, flip: h(10) < 0.5 };
}

export function TideGlyph({ ch, className }: { ch: string; className?: string }) {
  const g = glyphParts(ch);
  const s = { stroke: "currentColor", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const, fill: "none" };
  const dy = g.cy;
  return (
    <svg aria-hidden="true" viewBox="0 0 12 20" className={className} overflow="visible">
      <line x1={6} y1={g.top} x2={6} y2={g.bottom} {...s} />
      <circle cx={6} cy={g.top} r={0.9} fill="currentColor" />
      <circle cx={6} cy={g.bottom} r={0.9} fill="currentColor" />
      {g.shape === 0 ? <circle cx={6} cy={dy} r={g.r} {...s} /> : null}
      {g.shape === 1 ? <path d={`M6 ${dy - g.r - 0.6} L${6 + g.r} ${dy} L6 ${dy + g.r + 0.6} L${6 - g.r} ${dy}Z`} {...s} /> : null}
      {g.shape === 2 ? <path d={`M6 ${dy - g.r} L${6 + g.r} ${dy + g.r * 0.8} L${6 - g.r} ${dy + g.r * 0.8}Z`} {...s} /> : null}
      {g.shape === 3 ? (
        <>
          <circle cx={6} cy={dy - g.r * 0.7} r={g.r * 0.6} {...s} />
          <circle cx={6} cy={dy + g.r * 0.7} r={g.r * 0.6} {...s} />
        </>
      ) : null}
      {g.shape === 4 ? <circle cx={6} cy={dy} r={g.r * 0.45} fill="currentColor" /> : null}
      {g.bar ? <line x1={6 - g.bar / 2} y1={dy + (g.flip ? -1 : 1) * (g.r + 2)} x2={6 + g.bar / 2} y2={dy + (g.flip ? -1 : 1) * (g.r + 2)} {...s} /> : null}
      {g.crescent ? <path d={`M${g.flip ? 1.5 : 10.5} ${dy - 3.5} A 4.5 4.5 0 0 ${g.flip ? 0 : 1} ${g.flip ? 1.5 : 10.5} ${dy + 3.5}`} {...s} /> : null}
      {g.beadMid ? <circle cx={6} cy={(dy + g.bottom) / 2 + 1} r={0.7} fill="currentColor" /> : null}
    </svg>
  );
}
