"use client";
/**
 * Things in orbit and passing through, once the planet is revealed. Each object
 * moves as what it is:
 * - Satellites and stations orbit like moons: one shared plane (the planet's
 *   equator, seen nearly edge-on with a slight tilt), all the same way round,
 *   sweeping right to left across the front of the planet, round its left side,
 *   then back behind it (hidden by its disc), slightly larger on the near side.
 *   Outer orbits are slower; an orbit takes minutes. Most hold their attitude;
 *   the ring station turns, the sounder spins.
 * - Since the Tide nothing leaves: the atmosphere cannot be crossed, so the
 *   satellites are relics from before, and ships only ever arrive. One comes in
 *   from the far side of space, small and distant, grows as it nears, picks up
 *   speed, flares at the atmosphere and is lost there.
 * - Debris and wrecks drift in from the far side, tumbling slowly.
 * Never more than two at a time. Each has a thin leader line pointing at it
 * with a short label translated from the Tide's script. Small, slow, dimmer on
 * the night side. Off under reduced motion.
 *
 * The list changes rarely (React); positions are set every frame on the
 * elements directly (transform-only, sub-pixel), so motion stays smooth.
 */
import { useEffect, useRef, useState } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { DRIFTERS } from "./drifters";
import { frameGeometry } from "./HeroScene";

type Mode = "orbit" | "arrival" | "drift";

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
  asteroid: { mode: "drift", spin: 2.5, weight: 2, labels: [["Fragment", "Tumbling"]] },
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
 * An arrival's path (artwork fractions): from off the left edge, a gentle curve
 * into a point on the planet's visible limb (just inside the atmosphere).
 */
function arrivalPath(level: number): [number, number, number, number, number, number] {
  const th = Math.PI * rand(0.86, 1.12);
  const ex = 1.0122 + 0.4415 * 0.99 * Math.cos(th);
  const ey = 0.65 + 0.4415 * (2000 / 1126) * 0.99 * Math.sin(th);
  const sx = -0.08;
  const sy = level + rand(-0.15, 0.15);
  return [sx, sy, (sx + ex) / 2, (sy + ey) / 2 + rand(-0.15, 0.15), ex, ey];
}

/** The shared orbital plane: nearly edge-on, tilted slightly. */
const PLANE_INC = 1.36;
const PLANE_NODE = -0.14;
/** Never more than this many things in motion at once. */
const MAX_TOTAL = 2;

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
    // Fixed callouts and notes on screen (refreshed now and then): a moving
    // object's label stays quiet while it passes near one, so they never overlap.
    let busy: DOMRect[] = [];
    let busyAt = 0;

    const spawn = (now: number, mode: Mode, first = false) => {
      const pool = DRIFTERS.filter((d) => PROFILES[d.name]?.mode === mode && !recent.includes(d.name));
      const d = weighted(pool.length ? pool : DRIFTERS.filter((x) => PROFILES[x.name]?.mode === mode), (x) => PROFILES[x.name]!.weight);
      const prof = PROFILES[d.name]!;
      recent.push(d.name);
      if (recent.length > 5) recent.shift();
      const id = nextId++;
      const [title, line] = prof.labels[Math.floor(Math.random() * prof.labels.length)]!;
      // Orbits: keep apart from the other orbiter's radius; outer ones slower (Kepler).
      const taken = [...motionMap.values()].filter((o) => o.mode === "orbit").map((o) => o.R);
      let R = d.name === "orb" ? rand(1.6, 1.8) : rand(1.18, 1.6);
      for (let tries = 0; tries < 8 && taken.some((r) => Math.abs(r - R) < 0.14); tries++) R = rand(1.18, 1.6);
      const period = 300000 * Math.pow(R / 1.35, 1.5);
      const level = rand(0.25, 0.75);
      const m: Motion = {
        mode,
        t0: now,
        // Orbiters stay one orbit (leaving while behind the planet); an arrival
        // takes under a minute; debris a couple of minutes.
        life: mode === "orbit" ? period : mode === "arrival" ? rand(40000, 55000) : rand(120000, 160000),
        R,
        inc: PLANE_INC + rand(-0.03, 0.03),
        node: PLANE_NODE + rand(-0.02, 0.02),
        // The first is already crossing the visible side; later ones come round
        // from behind the planet, off screen to the right.
        a0: first ? rand(1.0, 1.9) : rand(-0.3, -0.1),
        w: (Math.PI * 2) / period,
        // Arrivals: from the far side of space (off the left edge) down a gentle
        // curve into the planet's limb (pulled in by it). Debris: a slow drift
        // in from the far side, nearly level.
        p: mode === "arrival" ? arrivalPath(level) : [-0.06, rand(0.2, 0.8), 0.3, rand(0.2, 0.8), 0.62, rand(0.2, 0.8)],
        size: mode === "arrival" ? rand(0.012, 0.016) : mode === "orbit" ? rand(0.009, 0.013) : rand(0.008, 0.012),
        rot0: mode === "drift" ? rand(0, 360) : rand(-12, 12),
        spin: (prof.spin * (Math.random() < 0.5 ? -1 : 1)) / 1000,
        base: 0,
      };
      motionMap.set(id, m);
      // Labels sit on the side with more open space.
      const side = mode === "drift" ? "right" : "left";
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
        // On reveal: one satellite already crossing the planet.
        spawn(now, "orbit", true);
        nextAt = now + rand(25000, 45000);
      } else if (on && nextAt && now >= nextAt) {
        if (all.length < MAX_TOTAL) {
          const busyModes = new Set(all.map((m) => m.mode));
          const r = Math.random();
          let mode: Mode = r < 0.6 ? "orbit" : r < 0.8 ? "arrival" : "drift";
          // One arrival or one piece of debris at a time.
          if (mode !== "orbit" && busyModes.has(mode)) mode = "orbit";
          spawn(now, mode);
        }
        nextAt = now + rand(30000, 60000);
      }

      const rect = root.getBoundingClientRect();
      if (now - busyAt > 400) {
        busyAt = now;
        busy = [...document.querySelectorAll<HTMLElement>(".hero-ui .tracked, .obs-on .tracked, .hero-haiku, .hero-hint")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
      }
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
        if (m.mode === "orbit") {
          // A tilted circular orbit seen from the front: the near half crosses
          // in front of the planet, the far half passes behind it.
          const t = m.a0 + m.w * age;
          const ox = Math.cos(t);
          const oy = Math.sin(t) * Math.cos(m.inc);
          z = Math.sin(t) * Math.sin(m.inc);
          const cn = Math.cos(m.node), sn = Math.sin(m.node);
          x = pcx + pr * m.R * (ox * cn - oy * sn);
          y = pcy + pr * m.R * (ox * sn + oy * cn);
          behind = z < 0;
          depth = 1 + 0.18 * z;
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
            depth = 0.55 + 0.6 * v;
            heat = smooth(0.84, 0.97, v);
          } else {
            depth = 0.95 + 0.1 * Math.sin(u * Math.PI);
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
            : `brightness(${(1 - 0.5 * night + 0.08 * z).toFixed(3)})`;
        }
        // Long, eased fades at both ends; never fully opaque (they are far off).
        const fade = m.mode === "arrival" ? smooth(0, 0.12, u) * (1 - smooth(0.965, 1, u)) : smooth(0, 0.06, u) * (1 - smooth(0.94, 1, u));
        el.style.opacity = (fade * 0.85).toFixed(3);
        // The callout follows the object; it hides while the object is behind.
        const tag = el.lastElementChild as HTMLElement | null;
        if (tag) {
          const r = Math.max(5, m.base * k * 0.45);
          tag.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
          const vis = fade > 0.6 && hidden < 0.5 && x > 8 && x < rect.width - 8 && y > 8 && y < rect.height - 8;
          tag.style.opacity = vis ? "1" : "0";
          tag.style.setProperty("--r", `${r.toFixed(1)}px`);
          // The label's area (beside the object, on its side); hide its text if a
          // fixed callout is there. The leader line stays.
          const lx0 = tag.dataset.side === "left" ? x - 230 : x - 10;
          const lx1 = tag.dataset.side === "left" ? x + 10 : x + 230;
          const crowded = busy.some((b) => b.right - rect.left > lx0 - 12 && b.left - rect.left < lx1 + 12 && b.bottom - rect.top > y - 36 && b.top - rect.top < y + 36);
          const text = tag.lastElementChild as HTMLElement | null;
          if (text) text.style.opacity = crowded ? "0" : "1";
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
