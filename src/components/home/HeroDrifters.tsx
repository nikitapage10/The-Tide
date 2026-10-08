"use client";
/**
 * Things in orbit and passing through, once the planet is revealed. Each moves
 * as what it is, seen with real perspective (larger near the camera, a few
 * pixels by the horizon, where they fade):
 * - Satellites and stations orbit low, all the same way round: each comes in
 *   from the right side of the screen, arcs left over the planet's upper face
 *   (nearest the camera, largest), curves down the left side into the horizon
 *   (shrinking and fading) and slips behind. Each orbit differs a little in
 *   height, tilt and where it meets the horizon; crossing takes about two
 *   minutes. Most hold their attitude; the ring station turns, the sounder spins.
 * - A moon fragment surfaces out of the dark, is caught, and spirals in to be
 *   lost behind the planet.
 * - Since the Tide nothing leaves: the atmosphere cannot be crossed, so ships
 *   only arrive. One appears far out in the dark, grows as it falls in, flares
 *   at the atmosphere and is lost there.
 * - Debris surfaces out of the dark, drifts a little, and sinks back into it.
 * Two at first, then something every ten to twenty seconds, never more than
 * three at once. Each has a thin leader line with a short label translated
 * from the Tide's script. Off under reduced motion.
 *
 * The list changes rarely (React); positions are set every frame on the
 * elements directly (transform-only, sub-pixel), so motion stays smooth.
 */
import { useEffect, useRef, useState } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { DRIFTERS } from "./drifters";
import { frameGeometry } from "./HeroScene";

type Mode = "orbit" | "capture" | "arrival" | "drift";

interface Profile {
  mode: Mode;
  /** Rotation in degrees per second (0 = holds its attitude). Ships face their course. */
  spin: number;
  /** Relative chance of being chosen within its mode. */
  weight: number;
  /** Short and plain: what it is, and one thing about it. */
  labels: [string, string][];
}

const PROFILES: Record<string, Profile> = {
  relay: { mode: "orbit", spin: 0, weight: 3, labels: [["Relay", "Silent"], ["Old relay", "Faint carrier"]] },
  "dish-probe": { mode: "orbit", spin: 0, weight: 3, labels: [["Listening post", "Aimed outward"], ["Array", "Still listening"]] },
  "ring-station": { mode: "orbit", spin: 2.2, weight: 2, labels: [["Ring station", "Turning"], ["Halo", "Dark windows"]] },
  sputnik: { mode: "orbit", spin: 7, weight: 2, labels: [["Sounder", "Spin-stable"], ["Sounder", "Pulsing"]] },
  "sphere-station": { mode: "orbit", spin: 0, weight: 2, labels: [["Keep", "Sealed"], ["Keep", "No lights"]] },
  beacon: { mode: "orbit", spin: 1.2, weight: 1, labels: [["Marker", "Older than the charts"]] },
  "cross-beacon": { mode: "orbit", spin: 0, weight: 1, labels: [["Waymark", "Holding station"]] },
  orb: { mode: "orbit", spin: 0, weight: 0.5, labels: [["Lantern", "Dim side toward us"]] },
  needle: { mode: "arrival", spin: 0, weight: 1, labels: [["Arrival", "Inbound"], ["Vessel", "From the far side"]] },
  "needle-2": { mode: "arrival", spin: 0, weight: 1, labels: [["Arrival", "Not slowing"], ["Vessel", "Inbound"]] },
  asteroid: { mode: "capture", spin: 2, weight: 1, labels: [["Moon fragment", "Falling inward"], ["Moon fragment", "Captured"]] },
  wreck: { mode: "drift", spin: 0.9, weight: 2, labels: [["Hull", "Cold"], ["Wreck", "No answer"]] },
  "broken-ring": { mode: "drift", spin: 0.6, weight: 1, labels: [["Broken arc", "Once whole"]] },
  "rock-cluster": { mode: "drift", spin: 0.8, weight: 1, labels: [["Debris", "Spreading"]] },
  "debris-cluster": { mode: "drift", spin: 0.8, weight: 1, labels: [["Debris", "Drifting, slowly"]] },
};

interface Item {
  id: number;
  name: string;
  aspect: number;
  title: string;
  line: string;
  side: "left" | "right";
}

interface Motion {
  mode: Mode;
  t0: number;
  life: number;
  // Orbit: radius (planet radii), inclination, node angle, start angle, angular speed (rad/ms).
  R: number;
  inc: number;
  node: number;
  a0: number;
  w: number;
  // Arrival / drift: start, control and end points on the artwork (fractions), quadratic path.
  p: [number, number, number, number, number, number];
  /** Long side as a fraction of the artwork's width. */
  size: number;
  rot0: number;
  /** Degrees per ms. */
  spin: number;
  base: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const weighted = <T,>(xs: T[], w: (x: T) => number) => {
  const total = xs.reduce((s, x) => s + w(x), 0);
  let r = Math.random() * total;
  for (const x of xs) if ((r -= w(x)) <= 0) return x;
  return xs[xs.length - 1]!;
};
/**
 * An arrival's path (artwork fractions): it appears far out in the dark (a
 * speck), and falls along a gentle curve into a point on the planet's visible
 * limb (just inside the atmosphere).
 */
function arrivalPath(): [number, number, number, number, number, number] {
  const th = Math.PI * rand(0.86, 1.12);
  const ex = 1.0122 + 0.4415 * 0.99 * Math.cos(th);
  const ey = 0.65 + 0.4415 * (2000 / 1126) * 0.99 * Math.sin(th);
  const sx = rand(0.06, 0.3);
  const sy = rand(0.15, 0.85);
  return [sx, sy, (sx + ex) / 2, (sy + ey) / 2 + rand(-0.12, 0.12), ex, ey];
}

/**
 * Debris in open space: it surfaces out of the dark somewhere away from the
 * edges, drifts a short way on a slight curve, and sinks back into the dark.
 */
function driftPath(): [number, number, number, number, number, number] {
  const sx = rand(0.08, 0.42);
  const sy = rand(0.18, 0.82);
  const a = rand(0, Math.PI * 2);
  const d = rand(0.06, 0.12);
  const ex = sx + Math.cos(a) * d;
  const ey = sy + Math.sin(a) * d * 1.6;
  const bend = rand(-0.04, 0.04);
  return [sx, sy, (sx + ex) / 2 - Math.sin(a) * bend, (sy + ey) / 2 + Math.cos(a) * bend * 1.6, ex, ey];
}

/** Camera distance from the planet's centre (planet radii): sets the perspective. */
const CAM = 2.1;
const perspective = (z: number) => CAM / Math.max(0.3, CAM - z);

/** Never more than this many things in motion at once. */
const MAX_TOTAL = 3;

export function HeroDrifters({ progress, className }: { progress: { current: number }; className?: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const els = useRef(new Map<number, HTMLDivElement>());
  const motions = useRef(new Map<number, Motion>());

  useEffect(() => {
    const root = layer.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const motionMap = motions.current;
    const elMap = els.current;
    let raf = 0;
    let visible = true;
    let nextAt = 0;
    let nextId = 1;
    const recent: string[] = [];
    const labelOn = new Set<number>();
    // Label placement, per object: which side it is on, and how long it has
    // been crowded / clear (so it changes side or hides only after a moment,
    // never flickering).
    const place = new Map<number, { side: "left" | "right"; bad: number; good: number; hidden: boolean; vis: boolean }>();

    const spawn = (now: number, mode: Mode, first = false) => {
      const pool = DRIFTERS.filter((d) => PROFILES[d.name]?.mode === mode && !recent.includes(d.name));
      const d = weighted(pool.length ? pool : DRIFTERS.filter((x) => PROFILES[x.name]?.mode === mode), (x) => PROFILES[x.name]!.weight);
      const prof = PROFILES[d.name]!;
      recent.push(d.name);
      if (recent.length > 5) recent.shift();
      const id = nextId++;
      const [title, line] = prof.labels[Math.floor(Math.random() * prof.labels.length)]!;
      // Orbits: low, just above the atmosphere; each a little different in
      // height, tilt and where it meets the horizon.
      const R = d.name === "orb" ? rand(1.16, 1.22) : rand(1.06, 1.14);
      // Half an orbit (right side round to the left horizon): slow.
      const half = rand(100000, 130000);
      const a0 = mode === "capture" ? 0.45 : first ? rand(0.7, 1.5) : rand(0.4, 0.55);
      const m: Motion = {
        mode,
        t0: now,
        // Orbiters stay one orbit (leaving while behind the planet); an arrival
        // takes under a minute; debris a couple of minutes.
        // Orbiters leave once they are behind the planet again.
        life: mode === "orbit" ? ((Math.PI + 0.3 - a0) / Math.PI) * half : mode === "capture" ? rand(120000, 150000) : mode === "arrival" ? rand(75000, 95000) : rand(70000, 95000),
        // A captured fragment starts well out and spirals in (R shrinks over its life).
        R: mode === "capture" ? rand(1.8, 2.0) : R,
        // Tilt: how high the near half arches (cos = arch / radius). Chosen so
        // the whole arc stays on screen: its high point near the top right,
        // over the planet, curving down the left to the horizon at mid-height.
        inc: Math.acos(mode === "capture" ? rand(0.5, 0.6) : rand(0.55, 0.68)),
        // Where the orbit meets the horizon on the left (screen angle, y down).
        node: (Math.PI / 180) * rand(182, 196),
        a0,
        w: mode === "capture" ? 0 : Math.PI / half,
        // Arrivals: from the far side of space (off the left edge) down a gentle
        // curve into the planet's limb (pulled in by it). Debris: a slow drift
        // in from the far side, nearly level.
        p: mode === "arrival" ? arrivalPath() : driftPath(),
        // Sizes at the planet's distance (perspective scales them from there):
        // small things, a few pixels by the horizon.
        size: mode === "arrival" ? rand(0.009, 0.012) : mode === "orbit" ? rand(0.0055, 0.0075) : mode === "capture" ? rand(0.006, 0.008) : rand(0.006, 0.009),
        rot0: mode === "drift" || mode === "capture" ? rand(0, 360) : rand(-12, 12),
        spin: (prof.spin * (Math.random() < 0.5 ? -1 : 1)) / 1000,
        base: 0,
      };
      motionMap.set(id, m);
      // Labels sit on the side with more open space.
      const side = mode === "drift" ? "right" : "left";
      if (mode === "capture") m.w = (Math.PI + 0.3 - m.a0) / m.life;
      setItems((xs) => [...xs, { id, name: d.name, aspect: d.w / d.h, title, line, side }]);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const p = progress.current;
      root.style.opacity = String(smooth(0.72, 0.92, p));
      const on = p >= 0.72;
      const all = [...motionMap.values()];
      if (on && !nextAt && all.length === 0) {
        // On reveal: a satellite already crossing the planet, and something
        // surfacing out in the dark.
        spawn(now, "orbit", true);
        spawn(now, "drift", true);
        nextAt = now + rand(8000, 14000);
      } else if (on && nextAt && now >= nextAt) {
        if (all.length < MAX_TOTAL) {
          const count = (md: Mode) => all.filter((m) => m.mode === md).length;
          const r = Math.random();
          let mode: Mode = r < 0.45 ? "orbit" : r < 0.6 ? "capture" : r < 0.8 ? "arrival" : "drift";
          // At most two satellites, and one of each other kind, at a time.
          if (mode === "orbit" && count("orbit") >= 2) mode = "drift";
          if (mode !== "orbit" && count(mode) >= 1) mode = count("orbit") < 2 ? "orbit" : mode;
          if (count(mode) < (mode === "orbit" ? 2 : 1)) spawn(now, mode);
        }
        nextAt = now + rand(10000, 20000);
      }

      const rect = root.getBoundingClientRect();
      const g = frameGeometry(rect.width, rect.height);
      const sP = 1.25 - 0.25 * p;
      const toScreen = (fx: number, fy: number): [number, number] => [
        g.cx - g.fw / 2 + (0.85 + (fx - 0.85) * sP) * g.fw,
        g.cy - g.fh / 2 + (0.58 + (fy - 0.58) * sP) * g.fh,
      ];
      const [pcx, pcy] = toScreen(1.0122, 0.65);
      const pr = (883 / 2000) * g.fw * sP;

      for (const [id, m] of motionMap) {
        const el = elMap.get(id);
        if (!el) continue;
        const age = now - m.t0;
        const u = age / m.life;
        if (u >= 1) {
          motionMap.delete(id);
          elMap.delete(id);
          setItems((xs) => xs.filter((x) => x.id !== id));
          continue;
        }
        let x: number, y: number;
        let depth = 1;
        let behind = false;
        let z = 0;
        let rot = m.rot0 + m.spin * age;
        // Arrivals: heat as they meet the atmosphere (flare, then lost).
        let heat = 0;
        if (m.mode === "orbit" || m.mode === "capture") {
          // A tilted circular orbit: from the right side of the screen it arcs
          // over the planet's upper face (its near half: nearest the camera and
          // largest), curves down the left into the horizon at about mid-height,
          // and passes behind there, fading. A captured fragment's orbit shrinks as
          // it falls in, and it is lost behind the same way.
          const t = m.a0 + m.w * age;
          const R = m.mode === "capture" ? m.R - (m.R - 1.06) * smooth(0, 1, u) : m.R;
          const ax = Math.cos(m.node), ay = Math.sin(m.node);
          let bx = -ay, by = ax;
          if (by > 0) {
            bx = -bx;
            by = -by;
          }
          const ci = Math.cos(m.inc);
          const ox = -Math.cos(t) * ax + Math.sin(t) * ci * bx;
          const oy = -Math.cos(t) * ay + Math.sin(t) * ci * by;
          z = R * Math.sin(t) * Math.sin(m.inc);
          x = pcx + pr * R * ox;
          y = pcy + pr * R * oy;
          behind = z < 0;
          // Perspective: larger crossing in front, a few pixels by the horizon.
          depth = perspective(z);
        } else {
          const [x0, y0, cx, cy, x1, y1] = m.p;
          // Arrivals speed up as the planet pulls them in.
          const v = m.mode === "arrival" ? Math.pow(u, 1.35) : u;
          const fx = (1 - v) * (1 - v) * x0 + 2 * (1 - v) * v * cx + v * v * x1;
          const fy = (1 - v) * (1 - v) * y0 + 2 * (1 - v) * v * cy + v * v * y1;
          [x, y] = toScreen(fx, fy);
          if (m.mode === "arrival") {
            // Nose along the course (the sprites point up); nearer, so larger.
            const dx = 2 * (1 - v) * (cx - x0) + 2 * v * (x1 - cx);
            const dy = (2 * (1 - v) * (cy - y0) + 2 * v * (y1 - cy)) * (g.fh / g.fw);
            rot = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
            // Far out at first (a speck), nearer and larger as it falls in.
            depth = 0.25 + 1.05 * Math.pow(v, 1.4);
            heat = smooth(0.84, 0.97, v);
          } else {
            depth = 0.7;
          }
        }
        const body = el.firstElementChild as HTMLElement | null;
        if (!m.base) {
          m.base = m.size * g.fw;
          if (body) body.style.width = body.style.height = `${Math.ceil(m.base * 1.5)}px`;
        }
        const k = ((m.size * g.fw) / m.base) * sP * depth;
        const half = (Math.ceil(m.base * 1.5) / 2) * k;
        const left = x - half;
        const top = y - half;
        const dPlanet = Math.hypot(x - pcx, y - pcy);
        // Hidden while behind the disc (soft through the atmosphere).
        const hidden = behind ? smooth(pr + 18, pr + 4, dPlanet) : 0;
        const mask = behind
          ? `radial-gradient(circle at ${((pcx - left) / k).toFixed(1)}px ${((pcy - top) / k).toFixed(1)}px, transparent ${((pr + 4) / k).toFixed(1)}px, #000 ${((pr + 18) / k).toFixed(1)}px)`
          : "none";
        if (body) {
          body.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
          body.style.maskImage = mask;
          body.style.webkitMaskImage = mask;
          const img = body.firstElementChild as HTMLElement | null;
          if (img) img.style.transform = `rotate(${rot.toFixed(3)}deg)`;
          // Sunlight from the left: dimmer beside and over the night side.
          const near = 1 - smooth(1.0, 1.8, dPlanet / pr);
          const night = smooth(-0.3, 0.5, (x - pcx) / pr) * near;
          body.style.filter = heat > 0.001
            ? `brightness(${(1 + 1.6 * heat).toFixed(3)}) drop-shadow(0 0 ${(2 + 7 * heat).toFixed(1)}px rgba(214,226,255,${(0.9 * heat).toFixed(3)}))`
            : `brightness(${(1 - 0.5 * night + 0.05 * z).toFixed(3)})`;
        }
        // Long, eased fades at both ends; never fully opaque (they are far off).
        // Fades: things surface out of the dark and sink back into it; and what
        // is only a few pixels across is barely there.
        const fade =
          m.mode === "arrival"
            ? smooth(0, 0.2, u) * (1 - smooth(0.965, 1, u))
            : m.mode === "drift"
              ? smooth(0, 0.3, u) * (1 - smooth(0.7, 1, u))
              : m.mode === "capture"
                ? smooth(0, 0.2, u) * (1 - smooth(0.9, 1, u))
                : smooth(0, 0.06, u) * (1 - smooth(0.94, 1, u));
        const px = m.base * k;
        // Orbiters fade out as they pass the horizon (going behind).
        const past = m.mode === "orbit" || m.mode === "capture" ? smooth(-0.18, 0.04, z) : 1;
        el.style.opacity = (fade * past * 0.85 * smooth(3, 11, px)).toFixed(3);
        // The callout follows the object; it hides while the object is behind.
        const tag = el.lastElementChild as HTMLElement | null;
        if (tag) {
          const r = Math.max(5, m.base * k * 0.45);
          tag.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
          // Shown while the object is clearly in view (with hysteresis, so it
          // never blinks at the threshold).
          const pl = place.get(id) ?? { side: (tag.dataset.side as "left" | "right") ?? "left", bad: 0, good: 0, hidden: false, vis: false };
          place.set(id, pl);
          const wantVis = fade * past > 0.55 && hidden < 0.5 && x > 8 && x < rect.width - 8 && y > 8 && y < rect.height - 8;
          if (wantVis && px > 8) pl.vis = true;
          if (!wantVis || px < 5) pl.vis = false;
          const vis = pl.vis;
          tag.style.opacity = vis ? "1" : "0";
          tag.style.setProperty("--r", `${r.toFixed(1)}px`);
          // The label keeps a margin from the screen's edges: if its side would
          // run off for two seconds, it moves to the other side (if that fits).
          const PAD = 24;
          const fits = (sd: "left" | "right") => (sd === "left" ? x - 250 >= PAD : x + 250 <= rect.width - PAD) && y >= 40 + PAD && y <= rect.height - PAD - 20;
          if (fits(pl.side)) pl.bad = 0;
          else pl.bad += 16;
          const other = pl.side === "left" ? "right" : "left";
          if (pl.bad > 2000 && fits(other)) {
            pl.side = other;
            pl.bad = 0;
            setItems((xs) => xs.map((it) => (it.id === id ? { ...it, side: other } : it)));
          }
          // Each label decodes once, the first time its object is clearly in view.
          if (vis && !labelOn.has(id)) {
            labelOn.add(id);
            setShown((s) => ({ ...s, [id]: true }));
          }
        }
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(root);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      motionMap.clear();
    };
  }, [progress]);

  return (
    <div ref={layer} aria-hidden="true" className={className} style={{ opacity: 0 }}>
      {items.map((it) => (
        <div
          key={it.id}
          ref={(el) => {
            if (el) els.current.set(it.id, el);
          }}
          className="absolute inset-0"
          style={{ opacity: 0 }}
        >
          <div className="absolute left-0 top-0 flex items-center justify-center" style={{ transformOrigin: "0 0", willChange: "transform" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative sprite, positioned every frame */}
            <img
              src={`/brand/drifters/${it.name}.webp`}
              alt=""
              draggable={false}
              className="block max-w-none select-none"
              style={{ width: it.aspect >= 1 ? "66.6%" : `${it.aspect * 66.6}%`, height: it.aspect >= 1 ? `${66.6 / it.aspect}%` : "66.6%" }}
            />
          </div>
          {/* Callout: a thin leader line pointing at the object, and its label. */}
          <div data-side={it.side} className="absolute left-0 top-0 transition-opacity duration-700" style={{ opacity: 0, willChange: "transform" }}>
            <span
              className="absolute left-0 top-0"
              style={{ transform: `translate(calc(var(--r) * ${it.side === "left" ? -0.75 : 0.75} ${it.side === "left" ? "-" : "+"} 2px), calc(var(--r) * -0.75 - 2px))` }}
            >
              <svg width="1" height="1" overflow="visible" className="absolute left-0 top-0">
                <path d={it.side === "left" ? "M0 0 L-12 -12 L-46 -12" : "M0 0 L12 -12 L46 -12"} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
            <div
              className={`absolute w-max transition-opacity duration-500 ${it.side === "left" ? "text-right" : ""}`}
              style={
                it.side === "left"
                  ? { right: "calc(var(--r) * 0.75 + 54px)", top: "calc(var(--r) * -0.75 - 22px)" }
                  : { left: "calc(var(--r) * 0.75 + 54px)", top: "calc(var(--r) * -0.75 - 22px)" }
              }
            >
              <span className="tracked block text-[0.58rem] text-white/85">
                <Decode text={it.title} active={!!shown[it.id]} calc />
              </span>
              <span className="tracked block text-[0.55rem] leading-4 text-faint">
                <Decode text={it.line} active={!!shown[it.id]} delay={700} />
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
