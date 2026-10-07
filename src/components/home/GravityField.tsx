"use client";
/**
 * Gravity lens: a faint, blurred bend of light that follows the pointer.
 * Invisible at rest. It appears only while the pointer moves (energy rises
 * with speed and decays within about a second), stretching along the
 * direction of motion. Drawn additively between the planet and the meteors.
 * Reduced motion: nothing is drawn.
 */
import { useEffect, useRef } from "react";

export function GravityField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    const pos = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let energy = 0;
    let last = { x: 0, y: 0, t: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = () => {
      raf = 0;
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      energy *= 0.94;
      ctx.clearRect(0, 0, w, h);
      if (energy < 0.01) {
        running = false;
        return;
      }
      const r = Math.max(70, Math.min(w, h) * 0.11);
      const speed = Math.hypot(vel.x, vel.y);
      const angle = Math.atan2(vel.y, vel.x);
      const stretch = 1 + Math.min(0.9, speed / 40);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      // Soft halo: the bent light around the well.
      ctx.filter = "blur(18px)";
      const halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.4);
      halo.addColorStop(0, `rgba(255,255,255,${(0.05 * energy).toFixed(3)})`);
      halo.addColorStop(0.6, `rgba(220,230,240,${(0.035 * energy).toFixed(3)})`);
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.4 * stretch, r * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Einstein-ring arcs, bent along the motion and trailing behind it.
      ctx.filter = "blur(3px)";
      ctx.lineCap = "round";
      for (const [k, a] of [
        [1, 0.22],
        [0.72, 0.12],
      ] as const) {
        ctx.strokeStyle = `rgba(255,255,255,${(a * energy).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(-r * 0.15 * (stretch - 1), 0, r * 0.55 * k * stretch, r * 0.5 * k, 0, Math.PI * 0.55, Math.PI * 1.45);
        ctx.stroke();
      }

      // Faint flare streak.
      ctx.filter = "blur(6px)";
      const streak = ctx.createLinearGradient(-r * 2, 0, r * 2, 0);
      streak.addColorStop(0, "rgba(255,255,255,0)");
      streak.addColorStop(0.5, `rgba(255,255,255,${(0.08 * energy).toFixed(3)})`);
      streak.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = streak;
      ctx.fillRect(-r * 2, -1.5, r * 4, 3);
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const now = performance.now();
      const dt = Math.max(8, now - last.t);
      vel.x = vel.x * 0.7 + ((x - last.x) / dt) * 16 * 0.3;
      vel.y = vel.y * 0.7 + ((y - last.y) / dt) * 16 * 0.3;
      last = { x, y, t: now };
      if (!running) {
        pos.x = x;
        pos.y = y;
      }
      target.x = x;
      target.y = y;
      energy = Math.min(1, energy + Math.min(0.25, Math.hypot(vel.x, vel.y) / 60));
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
