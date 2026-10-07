"use client";
/**
 * Things in orbit and passing through, once the planet is revealed. A few at a
 * time (never a crowd): orbiters (relays, probes, stations, beacons) travel real
 * tilted orbits around the planet, in front of it and then behind it (hidden by
 * its disc), slightly larger on the near side; debris (rocks, shards, wrecks)
 * drifts across open space along slow curves, tumbling. Each carries a small
 * callout that follows it, its label translated from the Tide's script. All
 * slow and small; dimmer on the night side. Off under reduced motion.
 *
 * The list changes rarely (React); positions are set every frame on the
 * elements directly (transform-only, sub-pixel), so motion stays smooth.
 */
import { useEffect, useRef, useState } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { DRIFTERS, type DrifterKind } from "./drifters";
import { frameGeometry } from "./HeroScene";

const ORBITERS: DrifterKind[] = ["relay", "probe", "station", "beacon", "needle", "orb"];

/** Vague on purpose: the archive never quite knows what these are. */
const LABELS: Record<DrifterKind, [string, string][]> = {
  relay: [["Relay", "Silent, still in orbit"], ["Relay", "Last contact unknown"]],
  probe: [["Probe", "Signal faint, repeating"], ["Probe", "Listening"]],
  station: [["Station", "No answer on any band"], ["Station", "Orbit decaying"]],
  beacon: [["Beacon", "Source unknown"], ["Marker", "Older than the record"]],
  needle: [["Spindle", "Origin unresolved"], ["Vessel", "Course unchanged"]],
  orb: [["Object", "Designation withheld"]],
  rock: [["Debris", "Drifting, slowly"], ["Fragment", "Not from here"]],
  debris: [["Debris field", "Arrivals from elsewhere"]],
  crystal: [["Shard", "Unclassified"], ["Shard", "Resonating faintly"]],
  wreck: [["Hull fragment", "Record incomplete"], ["Wreckage", "Origin unresolved"]],
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
  orbit: boolean;
  t0: number;
  life: number;
  // Orbit: radius (planet radii), inclination, node angle, start angle, angular speed (rad/ms).
  R: number;
  inc: number;
  node: number;
  a0: number;
  w: number;
  // Drift: start, control and end points on the artwork (fractions), quadratic path.
  p: [number, number, number, number, number, number];
  /** Long side as a fraction of the artwork's width. */
  size: number;
  rot0: number;
  spin: number;
  base: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const MAX_ORBIT = 3;
const MAX_DRIFT = 1;

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

    const spawn = (now: number, orbit: boolean, first = false) => {
      const pool = DRIFTERS.filter((d) => ORBITERS.includes(d.kind) === orbit && !recent.includes(d.name) && (d.kind !== "orb" || Math.random() < 0.3));
      const d = pick(pool.length ? pool : DRIFTERS.filter((x) => ORBITERS.includes(x.kind) === orbit));
      recent.push(d.name);
      if (recent.length > 5) recent.shift();
      const id = nextId++;
      const [title, line] = pick(LABELS[d.kind]);
      const toLeft = Math.random() < 0.5;
      const m: Motion = {
        orbit,
        t0: now,
        // Orbiters stay for about one slow orbit; debris for one crossing.
        life: orbit ? rand(100000, 140000) : rand(70000, 95000),
        // Ring-like orbits (seen nearly edge-on, gently tilted): they cross the
        // visible half of the planet, swing round its left side through open
        // space, and pass behind it (the planet's centre is off to the right).
        R: rand(1.15, 1.55),
        inc: rand(1.05, 1.4),
        node: rand(-0.45, 0.45),
        // The first are already on the visible side; later ones come round
        // from the right, off screen.
        a0: first ? Math.PI + rand(-0.9, 0.9) : rand(-0.3, 0.3),
        w: ((Math.random() < 0.5 ? 1 : -1) * (Math.PI * 2)) / rand(110000, 150000),
        p: toLeft
          ? [rand(0.62, 0.8), rand(-0.06, 0.15), rand(0.35, 0.5), rand(0.3, 0.7), -0.06, rand(0.55, 1.05)]
          : [-0.06, rand(0.1, 0.9), rand(0.2, 0.4), rand(0.2, 0.8), rand(0.55, 0.7), rand(-0.06, 1.06)],
        size: orbit ? rand(0.009, 0.014) : rand(0.008, 0.015),
        rot0: orbit ? rand(-20, 20) : rand(0, 360),
        spin: (orbit ? rand(-0.5, 0.5) : rand(-2, 2)) / 1000,
        base: 0,
      };
      if (first && !orbit) m.t0 = now - m.life * rand(0.1, 0.3);
      motionMap.set(id, m);
      setItems((xs) => [...xs, { id, name: d.name, aspect: d.w / d.h, title, line, side: orbit || toLeft ? "left" : "right" }]);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const p = progress.current;
      root.style.opacity = String(smooth(0.72, 0.92, p));
      const on = p >= 0.72;
      const all = [...motionMap.values()];
      const nOrbit = all.filter((m) => m.orbit).length;
      const nDrift = all.length - nOrbit;
      if (on && !nextAt && all.length === 0) {
        // On reveal: two orbiters already in view and one piece of debris.
        spawn(now, true, true);
        spawn(now, true, true);
        spawn(now, false, true);
        nextAt = now + rand(6000, 12000);
      } else if (on && nextAt && now >= nextAt) {
        if (nOrbit < MAX_ORBIT) spawn(now, true);
        else if (nDrift < MAX_DRIFT) spawn(now, false);
        nextAt = now + rand(6000, 12000);
      }

      const rect = root.getBoundingClientRect();
      if (now - busyAt > 400) {
        busyAt = now;
        const stage = root.parentElement;
        busy = stage ? [...stage.querySelectorAll<HTMLElement>(".hero-ui .tracked, .obs-on .tracked, .hero-haiku")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0) : [];
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
        if (m.orbit) {
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
          const fx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1;
          const fy = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
          [x, y] = toScreen(fx, fy);
          depth = 0.95 + 0.1 * Math.sin(u * Math.PI);
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
          if (img) img.style.transform = `rotate(${(m.rot0 + m.spin * age).toFixed(3)}deg)`;
          // Sunlight from the left: dimmer beside and over the night side.
          const near = 1 - smooth(1.0, 1.8, dPlanet / pr);
          const night = smooth(-0.3, 0.5, (x - pcx) / pr) * near;
          body.style.filter = `brightness(${(1 - 0.5 * night + (m.orbit ? 0.08 * z : 0)).toFixed(3)})`;
        }
        // Long, eased fades at both ends; never fully opaque (they are far off).
        const fade = smooth(0, 0.06, u) * (1 - smooth(0.94, 1, u));
        el.style.opacity = (fade * 0.85).toFixed(3);
        // The callout follows the object; it hides while the object is behind.
        const tag = el.lastElementChild as HTMLElement | null;
        if (tag) {
          const r = Math.max(5, m.base * k * 0.45);
          tag.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
          const vis = fade > 0.6 && hidden < 0.5 && x > 8 && x < rect.width - 8 && y > 8 && y < rect.height - 8;
          tag.style.opacity = vis ? "1" : "0";
          // The label's area (beside the object, on its side); hide its text if a
          // fixed callout is there. The ring stays.
          const lx0 = tag.dataset.side === "left" ? x - 230 : x - 10;
          const lx1 = tag.dataset.side === "left" ? x + 10 : x + 230;
          const crowded = busy.some((b) => b.right + rect.left > lx0 + rect.left - 12 && b.left - rect.left < lx1 + 12 && b.bottom - rect.top > y - 36 && b.top - rect.top < y + 36);
          const text = tag.lastElementChild as HTMLElement | null;
          if (text) text.style.opacity = crowded ? "0" : "1";
          tag.style.setProperty("--r", `${r.toFixed(1)}px`);
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
          {/* Callout: a ring on the object, a leader line, and the translated label. */}
          <div data-side={it.side} className="absolute left-0 top-0 transition-opacity duration-700" style={{ opacity: 0, willChange: "transform" }}>
            <span className="absolute rounded-full border border-white/45" style={{ width: "calc(var(--r) * 2 + 6px)", height: "calc(var(--r) * 2 + 6px)", left: "calc(var(--r) * -1 - 3px)", top: "calc(var(--r) * -1 - 3px)" }} />
            <span className={`absolute top-0 h-px w-9 bg-white/35 ${it.side === "left" ? "right-[calc(var(--r)+5px)]" : "left-[calc(var(--r)+5px)]"}`} />
            <div className={`absolute -top-2 w-max transition-opacity duration-500 ${it.side === "left" ? "right-[calc(var(--r)+3rem)] text-right" : "left-[calc(var(--r)+3rem)]"}`}>
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
