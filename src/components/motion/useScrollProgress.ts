"use client";
/**
 * Writes a 0..1 scroll progress to a CSS variable (default --p) on the
 * element: how far a tall "track" has been scrolled through (for pinned,
 * sticky scenes), or how far an element has crossed the viewport. The same
 * mechanism as the home hero, for any section. Reduced motion pins it at 1.
 */
import { useEffect, type RefObject } from "react";

export function useScrollProgress(ref: RefObject<HTMLElement | null>, { mode = "track", name = "--p", onChange }: { mode?: "track" | "cross"; name?: string; onChange?: (p: number) => void } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty(name, "1");
      onChange?.(1);
      return;
    }
    let raf = 0;
    let last = -1;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = mode === "track" ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (vh + r.height);
      const v = Math.min(1, Math.max(0, p));
      if (Math.abs(v - last) < 0.0005) return;
      last = v;
      el.style.setProperty(name, v.toFixed(4));
      onChange?.(v);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [ref, mode, name, onChange]);
}
