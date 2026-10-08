"use client";
/**
 * Orbit sketch: the planet as it sits in the revealed hero, with a canvas over
 * it to draw how things should move (start where an object appears; arrows show
 * the direction). The drawing is turned into points relative to the planet
 * (centre and radius), so it can be reproduced on any screen size. The current
 * paths can be shown for comparison. Linked from the Workshop.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { frameGeometry } from "@/components/home/HeroScene";
import { orbitPath } from "@/components/home/HeroDrifters";

type Pt = [number, number];

/** The planet on screen at the end of the scroll (scale 1), as in the hero. */
function planetOnScreen(w: number, h: number) {
  const g = frameGeometry(w, h);
  return { cx: g.cx - g.fw / 2 + 1.0122 * g.fw, cy: g.cy - g.fh / 2 + 0.65 * g.fh, r: (883 / 2000) * g.fw };
}

export function OrbitSketch() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const drawing = useRef<Pt[] | null>(null);
  const [showCurrent, setShowCurrent] = useState(true);
  const [current] = useState(() => Array.from({ length: 6 }, () => orbitPath()));
  const [copied, setCopied] = useState(false);

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const P = planetOnScreen(w, h);
    // The current paths, faint and dashed.
    if (showCurrent) {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      for (const q of current) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const v = i / 40;
          const b0 = (1 - v) ** 3, b1 = 3 * (1 - v) ** 2 * v, b2 = 3 * (1 - v) * v * v, b3 = v ** 3;
          const x = P.cx + P.r * (b0 * q[0]! + b1 * q[2]! + b2 * q[4]! + b3 * q[6]!);
          const y = P.cy + P.r * (b0 * q[1]! + b1 * q[3]! + b2 * q[5]! + b3 * q[7]!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // Your strokes, with a dot where each starts and arrows along it.
    const all = drawing.current ? [...strokes, drawing.current] : strokes;
    ctx.strokeStyle = "rgba(255,214,140,0.95)";
    ctx.fillStyle = "rgba(255,214,140,0.95)";
    ctx.lineWidth = 2.2;
    for (const s of all) {
      if (s.length < 2) continue;
      const pts = s.map(([x, y]) => [P.cx + P.r * x, P.cy + P.r * y] as Pt);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pts[0]![0], pts[0]![1], 5, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 12; i < pts.length; i += 24) {
        const [x0, y0] = pts[i - 4]!, [x1, y1] = pts[i]!;
        const a = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 10 * Math.cos(a - 0.45), y1 - 10 * Math.sin(a - 0.45));
        ctx.lineTo(x1 - 10 * Math.cos(a + 0.45), y1 - 10 * Math.sin(a + 0.45));
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [strokes, showCurrent, current]);

  useEffect(() => {
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [paint]);

  const toPlanet = (e: React.PointerEvent): Pt => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    const P = planetOnScreen(rect.width, rect.height);
    return [(e.clientX - rect.left - P.cx) / P.r, (e.clientY - rect.top - P.cy) / P.r];
  };

  const output = JSON.stringify(
    strokes.map((s) => {
      // About 24 evenly spaced points per stroke, rounded.
      const step = Math.max(1, Math.floor(s.length / 24));
      return s.filter((_, i) => i % step === 0 || i === s.length - 1).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
    }),
  );

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#050506] text-white">
      <div className="hero-frame pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- static backdrop for drawing on */}
        <img src="/brand/planet-v2.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = [toPlanet(e)];
          paint();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          drawing.current.push(toPlanet(e));
          paint();
        }}
        onPointerUp={() => {
          const s = drawing.current;
          drawing.current = null;
          if (s && s.length > 3) setStrokes((xs) => [...xs, s]);
          else paint();
        }}
      />
      <div className="absolute left-4 top-4 max-w-sm space-y-3 bg-black/70 p-4 text-sm sm:left-8 sm:top-8">
        <p className="tracked text-[0.62rem] text-faint">
          <a href="/workshop/orbit-lab" className="text-white/60 no-underline hover:text-white">
            Workshop
          </a>{" "}
          / Orbit sketch
        </p>
        <p className="text-muted">Draw the path something should take: start where it first appears and follow it to where it disappears. Draw as many as you like (different kinds of pass). Arrows show the direction.</p>
        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" checked={showCurrent} onChange={(e) => setShowCurrent(e.target.checked)} />
          Show my current paths (dashed)
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tracked min-h-9 border border-white/30 px-3 text-[0.62rem] hover:border-white" onClick={() => setStrokes((xs) => xs.slice(0, -1))}>
            Undo
          </button>
          <button type="button" className="tracked min-h-9 border border-white/30 px-3 text-[0.62rem] hover:border-white" onClick={() => setStrokes([])}>
            Clear
          </button>
          <button
            type="button"
            disabled={strokes.length === 0}
            className="tracked min-h-9 border border-white/60 px-3 text-[0.62rem] hover:border-white disabled:opacity-40"
            onClick={() => {
              void navigator.clipboard?.writeText(output).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? "Copied" : "Copy for Claude"}
          </button>
        </div>
        {strokes.length ? <textarea readOnly value={output} className="h-20 w-full resize-none bg-black/60 p-2 font-[family-name:var(--font-mono)] text-[0.6rem] text-muted" onFocus={(e) => e.currentTarget.select()} /> : null}
      </div>
    </main>
  );
}
