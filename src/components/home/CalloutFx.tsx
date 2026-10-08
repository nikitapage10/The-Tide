"use client";
/**
 * Small particle effects that play at a callout's point while it is shown,
 * chosen by what the callout names (motes spreading in rings for the Drowning,
 * sparks for a storm, points lit by a passing sweep for a scan, and so on).
 *
 * The baseline: always subtle. Soft, slightly out-of-focus motes blended
 * additively, few bright cores. In space they carry no colour at all (a dim,
 * blurred grey drift); on the planet each may carry just a smidge of muted
 * colour matched to what it names (sea grey-teal for the Drowning, a faint
 * sage for Verdancy, a hint of sodium for failing lights), never saturated. Each effect is procedural: every particle's place is a function of
 * time and its own seed, so motion is smooth and nothing accumulates.
 * Decorative only; not drawn under reduced motion.
 */
import { useEffect, useRef } from "react";

export type FxKind =
  | "lightning"
  | "ripple"
  | "split"
  | "drift"
  | "sink"
  | "veil"
  | "bloom"
  | "brackets"
  | "isobars"
  | "flicker"
  | "tideline"
  | "grid"
  | "stream"
  | "glint"
  | "orbit"
  | "wave"
  | "echo"
  | "cold"
  | "arc"
  | "scan";

/** One particle: position (px from the point), brightness 0..1, radius px. */
type P = [number, number, number, number];
type RGB = [number, number, number];

/** Space: no colour. */
const NEUTRAL: RGB = [222, 226, 232];
/** Planet tints (muted; mixed halfway back to neutral when drawn). */
const TINT: Partial<Record<FxKind, RGB>> = {
  lightning: [226, 224, 255],
  ripple: [188, 222, 226],
  sink: [176, 198, 228],
  veil: [212, 206, 228],
  flicker: [242, 224, 196],
  grid: [206, 220, 236],
  split: [232, 210, 216],
  drift: [228, 222, 204],
  bloom: [198, 228, 204],
  isobars: [202, 214, 232],
  tideline: [192, 222, 222],
};

const TAU = Math.PI * 2;
const fr = (x: number) => x - Math.floor(x);
/** Stable pseudo-random per particle (and per salt). */
const h = (i: number, k = 0) => fr(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
const bell = (x: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, x)));

/** Each effect: how many particles, and where particle i is at time t (s). */
const FX: Record<FxKind, { n: number; at: (i: number, t: number) => P | null }> = {
  // Rings of motes spreading outward, as on water.
  ripple: {
    n: 96,
    at: (i, t) => {
      const ring = i % 3;
      const u = fr(t / 2.8 + ring / 3);
      const a = h(i) * TAU;
      const r = 4 + u * 40 + (h(i, 1) - 0.5) * 2;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.55, (1 - u) * 0.9, 0.9];
    },
  },
  // Motes drawn inward and down, spiralling: something pulling under.
  sink: {
    n: 80,
    at: (i, t) => {
      const u = fr(t / 3.2 + h(i));
      const a = h(i, 1) * TAU + u * 3.2;
      const r = 40 * (1 - u) * (1 - u);
      return [Math.cos(a) * r, Math.sin(a) * r * 0.6 + u * 4, bell(u) * 0.9, 0.9 + 0.5 * (1 - u)];
    },
  },
  // Sparks racing down a jagged path, in brief irregular strikes.
  lightning: {
    n: 70,
    at: (i, t) => {
      const strike = Math.floor(t / 1.7);
      const local = t - strike * 1.7;
      if (local > 0.35 || h(strike, 9) < 0.25) return null;
      const s = i / 70;
      const seg = Math.floor(s * 6);
      const jitter = (h(seg, strike) - 0.5) * 16;
      const x = jitter + (h(i, strike) - 0.5) * 3;
      const y = -30 + s * 62;
      const lit = local < 0.08 ? 1 : 0.5 * (1 - (local - 0.08) / 0.27);
      return [x, y, lit * (0.6 + 0.4 * h(i, 3)), 0.8];
    },
  },
  // A cloud of motes parting into two.
  split: {
    n: 80,
    at: (i, t) => {
      const side = i % 2 ? 1 : -1;
      const u = 0.5 + 0.5 * Math.sin(t * 0.8);
      const a = h(i) * TAU;
      const r = h(i, 1) * 10;
      return [side * u * 16 + Math.cos(a) * r, Math.sin(a) * r, 0.5 + 0.4 * h(i, 2), 0.9];
    },
  },
  // Motes drifting past, one way, at different depths.
  drift: {
    n: 40,
    at: (i, t) => {
      const sp = 0.12 + h(i) * 0.2;
      const u = fr(t * sp + h(i, 1));
      const y = (h(i, 2) - 0.5) * 34;
      return [-36 + u * 72, y + Math.sin(t + i) * 1.5, bell(u) * (0.4 + 0.6 * h(i, 3)), 0.6 + h(i, 4) * 0.9];
    },
  },
  // A band of fine haze settling down across the point.
  veil: {
    n: 110,
    at: (i, t) => {
      const u = fr(t / 4 + h(i) * 0.25);
      const x = (h(i, 1) - 0.5) * 70;
      const y = -26 + u * 52 + Math.sin(x * 0.15 + t) * 2;
      return [x, y, bell(u) * 0.35 * (1 - Math.abs(x) / 40), 0.7];
    },
  },
  // Motes opening into six petals and turning slowly.
  bloom: {
    n: 90,
    at: (i, t) => {
      const petal = i % 6;
      const s = h(i);
      const open = 0.5 + 0.5 * Math.sin(t * 1.2);
      const base = (petal / 6) * TAU + t * 0.15;
      const r = s * 20 * (0.4 + 0.6 * open);
      const a = base + Math.sin(s * Math.PI) * 0.35 * (h(i, 1) - 0.5) * 2;
      return [Math.cos(a) * r, Math.sin(a) * r, (0.3 + 0.7 * open) * (1 - s * 0.5), 0.8];
    },
  },
  // Motes converging on four corners, as if locking on.
  brackets: {
    n: 64,
    at: (i, t) => {
      const c = i % 4;
      const sx = c === 0 || c === 3 ? -1 : 1;
      const sy = c < 2 ? -1 : 1;
      const lock = Math.min(1, fr(t / 3.4) * 2.2);
      const d = 13 + (1 - lock) * 16;
      const along = h(i) * 8;
      const onX = h(i, 1) < 0.5;
      const x = sx * d - (onX ? sx * along : 0);
      const y = sy * d - (onX ? 0 : sy * along);
      return [x, y, 0.4 + 0.6 * lock * (0.5 + 0.5 * Math.sin(t * 6)), 0.8];
    },
  },
  // Motes flowing along nested pressure ovals.
  isobars: {
    n: 90,
    at: (i, t) => {
      const ring = i % 3;
      const r = 10 + ring * 9;
      const a = h(i) * TAU + t * (0.5 - ring * 0.12);
      return [Math.cos(a) * r, Math.sin(a) * r * 0.7, 0.55 - ring * 0.12, 0.8];
    },
  },
  // Points of light going out and coming back, unevenly.
  flicker: {
    n: 18,
    at: (i, t) => {
      const x = (h(i) - 0.5) * 36;
      const y = (h(i, 1) - 0.5) * 26;
      const on = h(i, Math.floor(t * (2 + h(i, 2) * 3))) > 0.35 ? 1 : 0.08;
      return [x, y, on * (0.6 + 0.4 * h(i, 3)), 1.1];
    },
  },
  // A shoreline of motes rising and falling.
  tideline: {
    n: 80,
    at: (i, t) => {
      const x = (i / 80 - 0.5) * 72;
      const y = Math.sin(x * 0.12 + t * 1.2) * 3 - Math.sin(t * 0.9) * 9;
      return [x, y + (h(i) - 0.5) * 2, (0.35 + 0.4 * h(i, 1)) * (1 - Math.abs(x) / 38), 0.8];
    },
  },
  // Motes tracing the meridians of a small globe, turning.
  grid: {
    n: 120,
    at: (i, t) => {
      const lon = (i % 6) / 6 * Math.PI + t * 0.4;
      const lat = (h(i) - 0.5) * Math.PI;
      const x = Math.cos(lat) * Math.sin(lon) * 20;
      const y = Math.sin(lat) * 20;
      const facing = Math.cos(lon) > 0 ? 1 : 0.25;
      return [x, y, 0.45 * facing, 0.7];
    },
  },
  // Motes flowing along a curving stream.
  stream: {
    n: 70,
    at: (i, t) => {
      const u = fr(t * 0.35 + h(i));
      const x = -36 + u * 72;
      const y = Math.sin(u * 5 + 1) * 10 + (h(i, 1) - 0.5) * 4;
      return [x, y, bell(u) * (0.5 + 0.5 * h(i, 2)), 0.8];
    },
  },
  // A burst of sparkles catching the light, then gone.
  glint: {
    n: 48,
    at: (i, t) => {
      const u = fr(t / 2.6);
      if (u > 0.5) return null;
      const arm = i % 4;
      const a = (arm / 4) * TAU + Math.PI / 4;
      const r = h(i) * 18 * (u / 0.5);
      return [Math.cos(a) * r, Math.sin(a) * r, (1 - u / 0.5) * (1 - h(i) * 0.6), 0.9];
    },
  },
  // Two motes on a tilted orbit, each with a fading trail.
  orbit: {
    n: 40,
    at: (i, t) => {
      const body = i % 2;
      const k = Math.floor(i / 2);
      const a = t * 1.2 + body * Math.PI - k * 0.06;
      return [Math.cos(a) * 22, Math.sin(a) * 7, (1 - k / 20) * 0.8, k === 0 ? 1.4 : 0.8];
    },
  },
  // A faint carrier wave of motes, scrolling.
  wave: {
    n: 70,
    at: (i, t) => {
      const x = (i / 70 - 0.5) * 64;
      const y = Math.sin(x * 0.35 - t * 4) * 6 * (1 - Math.abs(x) / 36);
      return [x, y, 0.5 * (1 - Math.abs(x) / 34), 0.8];
    },
  },
  // The same small ring of motes, returning later and fainter.
  echo: {
    n: 72,
    at: (i, t) => {
      const copy = i % 3;
      const u = fr(t / 2.4 - copy * 0.2);
      const a = h(i) * TAU;
      return [u * 26 + Math.cos(a) * 6, Math.sin(a) * 6, (1 - u) * (0.75 - copy * 0.2), 0.8];
    },
  },
  // Frost growing along six spokes, breathing.
  cold: {
    n: 90,
    at: (i, t) => {
      const spoke = i % 6;
      const s = h(i);
      const grow = 0.6 + 0.4 * Math.sin(t * 0.9);
      const r = s * 16 * grow;
      const a = (spoke / 6) * TAU + (h(i, 1) - 0.5) * 0.12 * (r / 16);
      return [Math.cos(a) * r, Math.sin(a) * r, 0.6 * (1 - s * 0.6), 0.7];
    },
  },
  // Light gathered into a fragment of a ring, sliding round.
  arc: {
    n: 80,
    at: (i, t) => {
      const a = t * 0.9 + (h(i) - 0.5) * 1.6;
      const r = 18 + (h(i, 1) - 0.5) * 1.5;
      const centre = 1 - Math.abs(h(i) - 0.5) * 2;
      return [Math.cos(a) * r, Math.sin(a) * r, 0.75 * centre, 0.8];
    },
  },
  // Scattered points, lit as a sweep passes over them.
  scan: {
    n: 60,
    at: (i, t) => {
      const a = h(i) * TAU;
      const r = 6 + h(i, 1) * 22;
      const sweep = fr(t / 3.2) * TAU;
      const since = fr((sweep - a) / TAU);
      return [Math.cos(a) * r, Math.sin(a) * r, 0.08 + 0.85 * Math.exp(-since * 9), 0.9];
    },
  },
};

const SIZE = 120;

export function CalloutFx({ kind, on, space = false }: { kind?: FxKind; on: boolean; space?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !kind || !on) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const fx = FX[kind];
    const tint = TINT[kind];
    const [cr, cg, cb] = space || !tint ? NEUTRAL : (NEUTRAL.map((v, k) => Math.round((v + tint[k]!) / 2)) as RGB);
    // Out of focus: softer still in space (a dim, blurred drift). The softness
    // comes from wide faint halos (a canvas blur filter is too costly here).
    const halo = space ? 4.6 : 3.6;
    const dim = space ? 0.65 : 0.85;
    const t0 = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - t0) / 1000;
      // Eases in over the first second.
      const intro = Math.min(1, t / 1.0);
      ctx.setTransform(dpr, 0, 0, dpr, SIZE / 2 * dpr, SIZE / 2 * dpr);
      ctx.clearRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < fx.n; i++) {
        const p = fx.at(i, t);
        if (!p) continue;
        const a = p[2] * intro * dim;
        if (a <= 0.01) continue;
        // A soft mote: a wide faint halo and a small, quiet core.
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(a * 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], p[3] * halo, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(a * 0.1).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], p[3] * 1.8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(a * 0.42).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], p[3] * 0.8, 0, TAU);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind, on, space]);

  if (!kind) return null;
  return <canvas ref={ref} aria-hidden="true" className={`callout-fx ${on ? "callout-fx-on" : ""}`} style={{ width: SIZE, height: SIZE }} />;
}
