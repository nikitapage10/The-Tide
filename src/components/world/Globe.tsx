"use client";
/**
 * The atlas globe: an orthographic sphere drawn in hairlines (graticule,
 * limb, a soft terminator), turning slowly, with charted places plotted as
 * points. The world was remade twice, so no old coastlines are drawn: only
 * what the sources chart appears. Pauses off-screen; still with reduced motion.
 */
import { useEffect, useRef } from "react";

export interface GlobePoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
}

export function Globe({ points = [], className = "" }: { points?: GlobePoint[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let rot = 0.6;
    let last = performance.now();
    const tilt = 0.38;
    // Fixed specks of drifting land (the Floating Mountains), in lat/lon.
    const specks = Array.from({ length: 46 }, (_, i) => {
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      return { lat: ((a - Math.floor(a)) - 0.5) * 140, lon: (b - Math.floor(b)) * 360 - 180, s: 0.6 + ((a * 7) % 1) * 1.2 };
    });
    const project = (lat: number, lon: number, R: number, cx: number, cy: number) => {
      const la = (lat * Math.PI) / 180;
      const lo = (lon * Math.PI) / 180 + rot;
      const x = Math.cos(la) * Math.sin(lo);
      let y = Math.sin(la);
      let z = Math.cos(la) * Math.cos(lo);
      // Tilt the axis toward the viewer.
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      y = y2;
      z = z2;
      return { x: cx + x * R, y: cy - y * R, z };
    };
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!still) rot += dt * 0.035;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.44;
      const cx = w / 2;
      const cy = h / 2;
      // Body: dark, lit faintly from the upper right; the terminator soft.
      const g = ctx.createRadialGradient(cx + R * 0.45, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, "rgba(190,205,222,0.16)");
      g.addColorStop(0.55, "rgba(120,135,150,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // Graticule: front half only, fading toward the limb.
      ctx.lineWidth = 0.7;
      const line = (pts: { x: number; y: number; z: number }[]) => {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          if (a.z < 0 || b.z < 0) continue;
          ctx.strokeStyle = `rgba(215,225,236,${(0.05 + 0.2 * Math.min(a.z, b.z)).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      };
      for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => project(lat, i * 5 - 180, R, cx, cy)));
      for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 37 }, (_, i) => project(i * 5 - 90, lon, R, cx, cy)));
      // Limb.
      ctx.strokeStyle = "rgba(225,232,240,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      // Floating land: tiny, drifting just off the surface.
      for (const s of specks) {
        const p = project(s.lat, s.lon + now * 0.0004, R * 1.035, cx, cy);
        if (p.z < 0.05) continue;
        ctx.fillStyle = `rgba(225,232,240,${(0.15 + 0.45 * p.z).toFixed(3)})`;
        ctx.fillRect(p.x, p.y, s.s, s.s);
      }
      // Charted places.
      for (const pt of points) {
        const p = project(pt.lat, pt.lon, R, cx, cy);
        if (p.z < 0) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        ctx.font = "10px var(--font-mono), monospace";
        ctx.fillStyle = `rgba(255,255,255,${(0.4 + 0.6 * p.z).toFixed(2)})`;
        ctx.fillText(pt.label.toUpperCase(), p.x + 9, p.y + 3);
      }
      if (!still && visible) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver((e) => {
      const was = visible;
      visible = e.some((x) => x.isIntersecting);
      if (visible && !was && !still) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    });
    io.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [points]);
  return <canvas ref={ref} className={`block h-full w-full ${className}`} role="img" aria-label="A globe of the world, turning slowly. Charted places are marked." />;
}
