"use client";
/**
 * The withheld world name: a few cells of the Tide's script that keep turning
 * over, slowly, and never settle into English. Same width every time (it does
 * not give away the name's length). Screen readers hear "redacted".
 */
import { useEffect, useState } from "react";
import { TideGlyph } from "@/components/glyphs/TideScript";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CELLS = 5;
const rnd = (a: number, b: number) => (((a * 2654435761) ^ (b * 2246822519)) >>> 0) / 4294967296;

export function WorldName({ className = "" }: { className?: string }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // One cell turns over at a time, unhurried.
    const id = window.setInterval(() => setT((v) => v + 1), 700);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className={`world-name ${className}`} title="The world's name is withheld">
      <span className="sr-only">[redacted]</span>
      <span aria-hidden="true" className="world-name-cells">
        {Array.from({ length: CELLS }, (_, i) => {
          // Each cell changes on its own beat.
          const beat = Math.floor((t + i * 3) / (CELLS + 1 + (i % 3)));
          const ch = CHARS[Math.floor(rnd(i + 1, beat + 7) * CHARS.length)]!;
          return (
            <span key={`${i}-${beat}`} className="world-name-cell">
              <TideGlyph ch={ch} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
