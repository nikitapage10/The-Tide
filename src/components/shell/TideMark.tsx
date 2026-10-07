import { TIDE_MARK as M } from "./tideMarkPaths";

/**
 * The Tide mark: a meridian with a bead at each end, a ring on its upper half,
 * and two widening crescents opening upward beneath it.
 *
 * `weight` is the hairline width in screen px (it does not scale with the
 * mark, so it stays crisp at header size); the crescents keep their taper and
 * gain the same hairline. `bead` scales the end beads (they need a little
 * extra presence when small).
 */
export function TideMark({ height = 56, weight = 0.9, bead = 1.8, className }: { height?: number; weight?: number; bead?: number; className?: string }) {
  const [, , w, h] = M.viewBox.split(" ").map(Number) as [number, number, number, number];
  const hair = { stroke: "currentColor", strokeWidth: weight, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg aria-hidden="true" viewBox={M.viewBox} height={height} width={(height * w) / h} className={className} overflow="visible">
      <line x1={M.cx} y1={M.line.y1} x2={M.cx} y2={M.line.y2} {...hair} />
      <circle cx={M.cx} cy={M.ring.cy} r={M.ring.r} fill="none" {...hair} />
      {M.arcs.map((d) => (
        <path key={d.slice(0, 16)} d={d} fill="currentColor" {...hair} strokeWidth={weight * 0.6} strokeLinejoin="round" />
      ))}
      {M.beads.map((b) => (
        <circle key={b.cy} cx={M.cx} cy={b.cy} r={b.r * bead} fill="currentColor" />
      ))}
    </svg>
  );
}
