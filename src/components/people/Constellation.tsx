/**
 * The peoples and their factions as a constellation: each people a bright
 * star on a ring, its factions small stars around it, and lines where the
 * sources record a bond or a quarrel between them. Drawn once on the server
 * (SVG); the stars breathe slowly in CSS.
 */
import Link from "next/link";
import type { EntityRecord, RelationshipRecord } from "@/lib/contract/schema";

export interface Star {
  record: EntityRecord;
  factions: EntityRecord[];
  href: string;
  factionHref: (id: string) => string;
}

export function Constellation({ stars, links }: { stars: Star[]; links: RelationshipRecord[] }) {
  const W = 1160;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2;
  const R = 225;
  const pos = new Map<string, { x: number; y: number; big: boolean }>();
  stars.forEach((s, i) => {
    const a = (i / stars.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R * 1.55;
    const y = cy + Math.sin(a) * R;
    pos.set(s.record.id, { x, y, big: true });
    // Factions fan outward, away from the centre (clear of the ring).
    const n = s.factions.length;
    const out = Math.atan2(y - cy, (x - cx) / 1.55);
    s.factions.forEach((f, j) => {
      const fa = out + (n > 1 ? (j / (n - 1) - 0.5) * Math.min(1.9, 0.62 * n) : 0);
      const fr = 64 + (j % 2) * 22;
      pos.set(f.id, { x: x + Math.cos(fa) * fr * 1.3, y: y + Math.sin(fa) * fr * 0.85, big: false });
    });
  });
  const lines = links.filter((l) => pos.has(l.fromId) && pos.has(l.toId) && !/faction of/i.test(l.label));
  return (
    <div className="constellation -mx-1 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[640px]" role="img" aria-labelledby="constellation-title">
        <title id="constellation-title">The peoples, their factions, and the bonds between them</title>
        {/* Bonds between factions and peoples. */}
        {lines.map((l) => {
          const a = pos.get(l.fromId)!;
          const b = pos.get(l.toId)!;
          const mx = (a.x + b.x) / 2 + (cy - (a.y + b.y) / 2) * 0.25;
          const my = (a.y + b.y) / 2 + ((a.x + b.x) / 2 - cx) * 0.12;
          return (
            <path key={l.id} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" strokeDasharray={l.canonStatus === "confirmed" ? undefined : "3 4"}>
              <title>{`${l.label}`}</title>
            </path>
          );
        })}
        {stars.map((s) => {
          const p = pos.get(s.record.id)!;
          return (
            <g key={s.record.id}>
              {s.factions.map((f) => {
                const q = pos.get(f.id)!;
                return <line key={f.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />;
              })}
              {s.factions.map((f) => {
                const q = pos.get(f.id)!;
                const left = q.x < p.x;
                return (
                  <Link key={f.id} href={s.factionHref(f.id)}>
                    <circle cx={q.x} cy={q.y} r="2.4" fill="rgba(255,255,255,0.75)" className="star-faint" />
                    <text x={q.x + (left ? -7 : 7)} y={q.y + 3.5} textAnchor={left ? "end" : "start"} className="constellation-label" fontSize="10.5">
                      {f.title}
                    </text>
                  </Link>
                );
              })}
              <Link href={s.href}>
                <circle cx={p.x} cy={p.y} r="14" fill="none" stroke={s.record.palette ?? "#dfe5ec"} strokeOpacity="0.5" className="star-halo" />
                <circle cx={p.x} cy={p.y} r="4.5" fill="#fff" />
                <text x={p.x} y={p.y - 22} textAnchor="middle" className="constellation-name" fontSize="15">
                  {s.record.title}
                </text>
              </Link>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
