"use client";
/**
 * Faint "alien code" around the pointer: tiny procedurally drawn glyphs
 * (strokes on a 3×4 grid) grouped like words, drifting slowly and fading.
 * Very light by design; sparse before you scroll, a little more present as you
 * scroll in. Decorative only (aria-hidden). Reduced motion: nothing is drawn.
 */
import { useEffect, useRef } from "react";

interface Word {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  glyphs: number[][]; // each glyph: list of stroke segments as point indices pairs
  alpha: number;
}

// 3 columns × 4 rows of anchor points per glyph cell.
const COLS = 3;
const ROWS = 4;

function makeGlyph(): number[] {
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

export function GlyphTrail({ progress, className }: { progress: { current: number }; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let words: Word[] = [];
    let raf = 0;
    let lastSpawn = 0;
    let last = { x: 0, y: 0, t: 0 };
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const cellW = 6;
    const cellH = 9;
    const gap = 4;

    const draw = (now: number) => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      words = words.filter((wd) => now - wd.born < wd.life);
      ctx.lineWidth = 0.8;
      ctx.lineCap = "round";
      for (const wd of words) {
        const t = (now - wd.born) / wd.life;
        const fade = Math.sin(Math.PI * t); // in and out
        const dt = now - wd.born;
        const ox = wd.x + wd.vx * dt;
        const oy = wd.y + wd.vy * dt;
        ctx.strokeStyle = `rgba(225,232,240,${(wd.alpha * fade).toFixed(3)})`;
        ctx.beginPath();
        wd.glyphs.forEach((g, gi) => {
          const gx = ox + gi * (cellW + gap);
          for (let i = 0; i < g.length; i += 2) {
            const a = g[i]!;
            const b = g[i + 1]!;
            ctx.moveTo(gx + (a % COLS) * (cellW / (COLS - 1)), oy + Math.floor(a / COLS) * (cellH / (ROWS - 1)));
            ctx.lineTo(gx + (b % COLS) * (cellW / (COLS - 1)), oy + Math.floor(b / COLS) * (cellH / (ROWS - 1)));
          }
        });
        ctx.stroke();
      }
      if (words.length) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const now = performance.now();
      const speed = Math.hypot(x - last.x, y - last.y) / Math.max(8, now - last.t);
      last = { x, y, t: now };
      const p = progress.current;
      // Sparse at first, a little more frequent as you scroll in.
      const interval = 520 - 300 * p;
      if (now - lastSpawn < interval || speed < 0.05) return;
      lastSpawn = now;
      const angle = Math.random() * Math.PI * 2;
      const dist = 36 + Math.random() * 70;
      const len = 3 + Math.floor(Math.random() * 5);
      words.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 0.006,
        vy: Math.sin(angle) * 0.006 - 0.004,
        born: now,
        life: 1600 + Math.random() * 900,
        glyphs: Array.from({ length: len }, makeGlyph),
        alpha: 0.15 + 0.2 * p,
      });
      if (words.length > 24) words.shift();
      if (!raf) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [progress]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
