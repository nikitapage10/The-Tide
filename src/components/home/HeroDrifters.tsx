"use client";
/**
 * Things passing through, now and then, once the planet is revealed: one at a
 * time, every so often. Orbiters (relays, probes, stations, beacons) travel the
 * dashed orbit drawn around the planet: up the left side in front, then behind
 * the planet (masked by its disc). Debris (rocks, shards, wrecks) drifts across
 * open space, slowly tumbling. Both dim on the planet's night side. Hovering one
 * types a small label beside it. Off under reduced motion.
 *
 * Imperative (one small rAF loop moving one or two elements), so scrolling and
 * the WebGL scene are untouched.
 */
import { useEffect, useRef } from "react";
import { DRIFTERS, type DrifterKind } from "./drifters";
import { frameGeometry } from "./HeroScene";

const ORBITERS: DrifterKind[] = ["relay", "probe", "station", "beacon", "needle", "orb"];

/** Vague on purpose: the archive never quite knows what these are. */
const LABELS: Record<DrifterKind, [string, string][]> = {
  relay: [["Relay", "Silent · still in orbit"], ["Relay", "Last contact unknown"]],
  probe: [["Probe", "Signal faint · repeating"], ["Probe", "Listening"]],
  station: [["Station", "No answer on any band"], ["Station", "Orbit decaying, slowly"]],
  beacon: [["Beacon", "Transmitting · source unknown"], ["Marker", "Placed before the record"]],
  needle: [["Spindle", "Origin unresolved"], ["Vessel", "Course unchanged"]],
  orb: [["Object", "Designation withheld"]],
  rock: [["Debris", "Drifting, slowly"], ["Fragment", "Not from here"]],
  debris: [["Debris field", "Arrivals from elsewhere"]],
  crystal: [["Shard", "Unclassified"], ["Shard", "Resonating, faintly"]],
  wreck: [["Hull fragment", "Record incomplete"], ["Wreckage", "Origin unresolved"]],
};

interface Pass {
  el: HTMLDivElement;
  img: HTMLImageElement;
  kind: DrifterKind;
  aspect: number;
  orbit: boolean;
  ready: boolean;
  t0: number;
  dur: number;
  /** Orbit: angles on the dashed ellipse. Drift: start/end on the artwork (fractions). */
  a0: number;
  a1: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Long side, as a fraction of the artwork's width. */
  size: number;
  rot0: number;
  spin: number;
  label: [string, string];
  code: string;
  /** Size the image was laid out at (px, long side); motion is transform-only after that. */
  base: number;
  /** Last placement on screen (for hover). */
  sx: number;
  sy: number;
  r: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function HeroDrifters({ progress, className }: { progress: { current: number }; className?: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = layer.current;
    const label = tag.current;
    if (!root || !label) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const titleEl = label.querySelector<HTMLElement>("[data-title]")!;
    const lineEl = label.querySelector<HTMLElement>("[data-line]")!;

    let raf = 0;
    let visible = true;
    let next = 0;
    let lastName = "";
    const passes: Pass[] = [];
    const pointer = { x: -1e4, y: -1e4 };
    let hovered: Pass | null = null;
    let typing = 0;
    let hideAt = 0;

    const spawn = (now: number) => {
      // Orbiters a little more often than debris; the orb is rare.
      const orbit = Math.random() < 0.58;
      const pool = DRIFTERS.filter((d) => ORBITERS.includes(d.kind) === orbit && d.name !== lastName && (d.kind !== "orb" || Math.random() < 0.35));
      const d = pick(pool.length ? pool : DRIFTERS);
      lastName = d.name;
      const el = document.createElement("div");
      el.style.cssText = "position:absolute;left:0;top:0;opacity:0;will-change:transform,opacity;display:flex;align-items:center;justify-content:center";
      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      img.style.cssText = "display:block;max-width:none;user-select:none";
      el.appendChild(img);
      root.appendChild(el);
      const toLeft = Math.random() < 0.5;
      const p: Pass = {
        el,
        img,
        kind: d.kind,
        aspect: d.w / d.h,
        orbit,
        ready: false,
        t0: now,
        dur: orbit ? rand(70000, 95000) : rand(80000, 120000),
        // Up from below, round the left side, then behind the planet's upper half.
        a0: Math.PI * rand(0.55, 0.7),
        a1: Math.PI * rand(1.75, 1.95),
        x0: toLeft ? 0.97 : -0.07,
        y0: rand(0.12, 0.88),
        x1: toLeft ? -0.07 : rand(0.6, 0.97),
        y1: rand(0.12, 0.88),
        // Small and far: things glimpsed, not set pieces.
        size: orbit ? rand(0.018, 0.03) : rand(0.014, 0.032),
        rot0: rand(0, 360),
        spin: (orbit ? rand(-0.8, 0.8) : rand(-2.5, 2.5)) / 1000,
        label: pick(LABELS[d.kind]),
        code: Math.floor(Math.random() * 0xffff)
          .toString(16)
          .padStart(4, "0"),
        base: 0,
        sx: -1e4,
        sy: -1e4,
        r: 0,
      };
      // Orbiters keep their artwork upright-ish; debris starts at any angle.
      if (orbit) p.rot0 = rand(-25, 25);
      img.onload = () => {
        p.ready = true;
        p.t0 = performance.now();
      };
      img.onerror = () => {
        p.dur = 0;
        p.ready = true;
      };
      img.src = `/brand/drifters/${d.name}.webp`;
      passes.push(p);
    };

    const typeLabel = (p: Pass) => {
      window.clearInterval(typing);
      const title = `${p.label[0]} · ${p.code.toUpperCase()}`;
      const line = p.label[1];
      let i = 0;
      titleEl.textContent = "";
      lineEl.textContent = "";
      typing = window.setInterval(() => {
        i += 1;
        titleEl.textContent = title.slice(0, i);
        lineEl.textContent = i > title.length ? line.slice(0, (i - title.length) * 1.6) : "";
        if (i > title.length + line.length / 1.6) window.clearInterval(typing);
      }, 28);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const pr0 = progress.current;
      const on = pr0 >= 0.72;
      root.style.opacity = String(smooth(0.72, 0.92, pr0));
      if (on && !next && passes.length === 0) next = now + rand(5000, 9000);
      if (on && next && now >= next && passes.length === 0) {
        next = 0;
        spawn(now);
      }

      const rect = root.getBoundingClientRect();
      const g = frameGeometry(rect.width, rect.height);
      const sP = 1.25 - 0.25 * pr0;
      const toScreen = (fx: number, fy: number): [number, number] => [
        g.cx - g.fw / 2 + (0.85 + (fx - 0.85) * sP) * g.fw,
        g.cy - g.fh / 2 + (0.58 + (fy - 0.58) * sP) * g.fh,
      ];
      const [pcx, pcy] = toScreen(1.0122, 0.65);
      const pr = (883 / 2000) * g.fw * sP;

      let hit: Pass | null = null;
      for (let i = passes.length - 1; i >= 0; i--) {
        const p = passes[i]!;
        if (!p.ready) continue;
        const u = (now - p.t0) / p.dur;
        if (!(u < 1)) {
          p.el.remove();
          passes.splice(i, 1);
          if (hovered === p) hovered = null;
          next = now + rand(25000, 60000);
          continue;
        }
        let x: number, y: number;
        let depth = 1;
        let behind = false;
        if (p.orbit) {
          // The dashed orbit in the interface: centre (88%, 62%), radii (40%, 60%) of the artwork.
          const th = p.a0 + (p.a1 - p.a0) * u;
          [x, y] = toScreen(0.88 + 0.4 * Math.cos(th), 0.62 + 0.6 * Math.sin(th));
          behind = Math.sin(th) < 0;
          depth = 0.88 + 0.12 * Math.sin(th);
        } else {
          [x, y] = toScreen(p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * u);
        }
        // Laid out once at its base size; after that only transforms change
        // (sub-pixel, composited), so the motion stays perfectly smooth.
        if (!p.base) {
          p.base = p.size * g.fw;
          const w = p.aspect >= 1 ? p.base : p.base * p.aspect;
          const h = p.aspect >= 1 ? p.base / p.aspect : p.base;
          const box = Math.ceil(p.base * 1.5);
          p.el.style.width = `${box}px`;
          p.el.style.height = `${box}px`;
          p.el.style.transformOrigin = "0 0";
          p.img.style.width = `${w.toFixed(1)}px`;
          p.img.style.height = `${h.toFixed(1)}px`;
        }
        const k = ((p.size * g.fw) / p.base) * sP * depth;
        const long = p.base * k;
        const half = (Math.ceil(p.base * 1.5) / 2) * k;
        const left = x - half;
        const top = y - half;
        p.el.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
        p.img.style.transform = `rotate(${(p.rot0 + p.spin * (now - p.t0)).toFixed(3)}deg)`;
        // Behind the planet: hidden by its disc (soft at the atmosphere). The
        // mask is in the element's own (unscaled) coordinates.
        const mask = behind
          ? `radial-gradient(circle at ${((pcx - left) / k).toFixed(1)}px ${((pcy - top) / k).toFixed(1)}px, transparent ${((pr + 4) / k).toFixed(1)}px, #000 ${((pr + 18) / k).toFixed(1)}px)`
          : "none";
        p.el.style.maskImage = mask;
        p.el.style.webkitMaskImage = mask;
        // Sunlight comes from the left: dimmer over and beside the night side.
        const nx = (x - pcx) / pr;
        const near = 1 - smooth(1.0, 1.8, Math.hypot(x - pcx, y - pcy) / pr);
        const night = smooth(-0.3, 0.5, nx) * near;
        p.el.style.filter = `brightness(${(1 - 0.55 * night).toFixed(3)})`;
        // Long, eased fades at both ends; never fully opaque (they are far off).
        const fade = smooth(0, 0.08, u) * (1 - smooth(0.92, 1, u));
        p.el.style.opacity = (fade * (behind ? 0.7 : 0.8)).toFixed(3);
        p.sx = x;
        p.sy = y;
        p.r = Math.max(22, long * 0.6);
        if (fade > 0.5 && Math.hypot(pointer.x - x, pointer.y - y) < p.r) hit = p;
      }

      // Hover label: types itself next to the object and follows it.
      if (hit && hit !== hovered) {
        hovered = hit;
        typeLabel(hit);
      }
      if (hit) hideAt = now + 700;
      if (hovered && now > hideAt) hovered = null;
      if (hovered) {
        label.style.opacity = "1";
        // Above and to the left: clear of the cursor's own readout (below right).
        label.style.transform = `translate3d(${(hovered.sx - hovered.r * 0.6).toFixed(1)}px, ${(hovered.sy - hovered.r - 34).toFixed(1)}px, 0) translateX(-100%)`;
      } else {
        label.style.opacity = "0";
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(root);
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(typing);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      for (const p of passes) p.el.remove();
    };
  }, [progress]);

  return (
    <div ref={layer} aria-hidden="true" className={className} style={{ opacity: 0 }}>
      <div ref={tag} className="pointer-events-none absolute left-0 top-0 z-[1] text-right opacity-0 transition-opacity duration-500" style={{ willChange: "transform" }}>
        <span data-title className="tracked block whitespace-nowrap text-[0.58rem] text-white/80" />
        <span data-line className="tracked block whitespace-nowrap text-[0.55rem] leading-4 text-faint" />
      </div>
    </div>
  );
}
