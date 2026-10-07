"use client";
/**
 * Faint "alien code" around the pointer, across the whole site: individual
 * procedurally drawn characters (strokes on a 3×4 grid) that drift away from
 * the cursor and fade. On the home hero they grow a little more present as you
 * scroll in (see `glyphPresence`). Decorative only (aria-hidden), never blocks
 * input. Reduced motion: nothing is drawn.
 */
import { useEffect, useRef } from "react";

/** 0..1: how present the glyphs are. The home hero drives it from scroll. */
export const glyphPresence = { current: 0.55 };
export const GLYPH_PRESENCE_DEFAULT = 0.55;

interface Glyph {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  segs: number[];
  alpha: number;
  size: number;
}

// 3 columns × 4 rows of anchor points per glyph cell.
const COLS = 3;
const ROWS = 4;
const MAX = 90;

function makeSegs(): number[] {
  const strokes = 2 + Math.floor(Math.random() * 3);
  const segs: number[] = [];
  for (let i = 0; i < strokes; i++) {
    const a = Math.floor(Math.random() * COLS * ROWS);
    let b = Math.floor(Math.random() * COLS * ROWS);
    if (b === a) b = (a + 1) % (COLS * ROWS);
    segs.push(a, b);
  }
  return segs;
}

export function GlyphTrail({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let glyphs: Glyph[] = [];
    let raf = 0;
    let lastSpawn = 0;
    let last = { x: 0, y: 0, t: 0 };
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      glyphs = glyphs.filter((g) => now - g.born < g.life);
      ctx.lineWidth = 0.9;
      ctx.lineCap = "round";
      for (const g of glyphs) {
        const dt = now - g.born;
        const t = dt / g.life;
        const fade = Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.4);
        const ox = g.x + g.vx * dt;
        const oy = g.y + g.vy * dt;
        const cw = g.size * 0.66;
        const ch = g.size;
        ctx.strokeStyle = `rgba(228,236,246,${Math.max(0, g.alpha * fade).toFixed(3)})`;
        ctx.beginPath();
        for (let i = 0; i < g.segs.length; i += 2) {
          const a = g.segs[i]!;
          const b = g.segs[i + 1]!;
          ctx.moveTo(ox + (a % COLS) * (cw / (COLS - 1)), oy + Math.floor(a / COLS) * (ch / (ROWS - 1)));
          ctx.lineTo(ox + (b % COLS) * (cw / (COLS - 1)), oy + Math.floor(b / COLS) * (ch / (ROWS - 1)));
        }
        ctx.stroke();
      }
      if (glyphs.length) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const x = e.clientX;
      const y = e.clientY;
      const now = performance.now();
      const speed = Math.hypot(x - last.x, y - last.y) / Math.max(8, now - last.t);
      last = { x, y, t: now };
      const p = glyphPresence.current;
      const interval = 150 - 80 * p;
      if (now - lastSpawn < interval || speed < 0.04) return;
      lastSpawn = now;
      const count = 1 + Math.floor(Math.random() * (2 + 2 * p));
      for (let k = 0; k < count; k++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 80;
        const drift = 0.006 + Math.random() * 0.008;
        glyphs.push({
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          vx: Math.cos(angle) * drift,
          vy: Math.sin(angle) * drift - 0.004,
          born: now,
          life: 1400 + Math.random() * 1400,
          segs: makeSegs(),
          alpha: (0.24 + 0.26 * p) * (0.6 + 0.4 * Math.random()),
          size: 9 + Math.random() * 4,
        });
      }
      if (glyphs.length > MAX) glyphs.splice(0, glyphs.length - MAX);
      if (!raf) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
