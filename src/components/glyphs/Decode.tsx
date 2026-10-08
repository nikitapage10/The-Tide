"use client";
/**
 * A label being translated: (optionally) a line of working churns where it will
 * appear, then the text arrives in the Tide's script (each glyph rolling in like
 * a slot reel, in no particular order), holds a beat, and each glyph resolves
 * into its English letter (in a different order). Every glyph sits in
 * its letter's own slot, so nothing shifts as it resolves. Screen readers get
 * the English text only; reduced motion shows it at once.
 */
import { useEffect, useState } from "react";
import { TideGlyph, hasGlyph } from "./TideScript";

const TICK = 30;
const CALC_TICKS = 20;
const HOLD_TICKS = 9;

/** How long a decode takes (ms), for staggering what follows it. */
export function decodeMs(text: string, calc = false) {
  return ((calc ? CALC_TICKS : 0) + text.length * 2 + HOLD_TICKS + ROLL_TICKS) * TICK;
}

/** Ticks a glyph spends rolling before it locks. */
const ROLL_TICKS = 5;
const SLOT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** Which way each glyph rolls in, across a word (varied, not alternating). */
const SLOT_PATTERN = ["down", "up", "up", "down", "up", "down", "down"] as const;

const OPS = ["∫", "Σ", "Δ", "∂", "√", "λ", "θ", "≈", "∝", "∇"];
// Deterministic churn (renders stay pure): a different line each tick.
const rnd = (n: number, k: number) => (((n * 2654435761) ^ (k * 2246822519)) >>> 0) / 4294967296;
/** The position of each index when sorted by key (a random permutation). */
function rankBy(n: number, key: (i: number) => number) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => key(a) - key(b));
  const rank = new Array<number>(n);
  idx.forEach((i, r) => (rank[i] = r));
  return rank;
}

function working(step: number) {
  const op = (k: number) => OPS[Math.floor(rnd(step, k) * OPS.length)]!;
  const num = (k: number) => (rnd(step, k) * 9.99).toFixed(3);
  return `${op(1)} ${num(2)} ${["·", "×", "→"][Math.floor(rnd(step, 3) * 3)]} ${op(4)} ${num(5)}`;
}

export function Decode({ text, active, delay = 0, calc = false }: { text: string; active: boolean; delay?: number; calc?: boolean }) {
  const [step, setStep] = useState(-1);
  const C = calc ? CALC_TICKS : 0;
  const total = C + text.length * 2 + HOLD_TICKS + ROLL_TICKS;
  useEffect(() => {
    if (!active) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer = 0;
    const start = window.setTimeout(() => {
      if (instant) {
        setStep(total);
        return;
      }
      let s = 0;
      setStep(0);
      timer = window.setInterval(() => {
        s += 1;
        setStep(s);
        if (s >= total) window.clearInterval(timer);
      }, TICK);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [active, text, delay, total]);

  const st = active ? step : -1;
  const n = text.length;
  // Random order (fixed per text): the order glyphs arrive in, and a different
  // order they resolve in, like a signal coming clear.
  const arrive = rankBy(n, (i) => rnd(i + 1, n * 7 + 1));
  const settle = rankBy(n, (i) => rnd(i + 1, n * 13 + 5));
  // Words (kept unbroken) with each one's starting index in the text.
  const words = text.split(/(\s+)/).reduce<{ w: string; at: number }[]>((acc, w) => {
    const prev = acc[acc.length - 1];
    acc.push({ w, at: prev ? prev.at + prev.w.length : 0 });
    return acc;
  }, []);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="relative">
        {st >= 0 && st < C ? (
          <span className="absolute left-0 top-0 whitespace-nowrap font-[family-name:var(--font-mono)] text-[0.85em] tracking-[0.12em] text-white/45">{working(Math.floor(st / 2))}</span>
        ) : null}
        {words.map(({ w, at }, wi) => {
          if (/^\s+$/.test(w)) return <span key={wi}>{w}</span>;
          return (
            <span key={wi} className="whitespace-nowrap">
              {[...w].map((ch, ci) => {
                const i = at + ci;
                const typed = st >= C + arrive[i]! + 1;
                const resolved = st >= C + n + ROLL_TICKS + HOLD_TICKS + settle[i]! + 1;
                if (!hasGlyph(ch)) {
                  return (
                    <span key={i} className={typed ? "" : "invisible"}>
                      {ch}
                    </span>
                  );
                }
                // Like a slot reel: each glyph rolls in (from above or below, in a
                // varied pattern), passing a couple of other glyphs before it
                // locks; when it resolves, it rolls out and the letter rolls in.
                const dir = SLOT_PATTERN[(i * 5 + n) % SLOT_PATTERN.length]!;
                const rolling = typed && st < C + arrive[i]! + 1 + ROLL_TICKS;
                const shownCh = rolling ? SLOT_CHARS[Math.floor(rnd(i + 1, Math.floor(st / 2)) * SLOT_CHARS.length)]! : ch;
                return (
                  <span key={i} className="decode-cell" data-dir={dir}>
                    <span className={`decode-letter ${resolved ? "decode-on" : ""}`}>{ch}</span>
                    {typed ? <TideGlyph key={rolling ? `r${Math.floor(st / 2)}` : "g"} ch={shownCh} className={`decode-glyph ${resolved ? "decode-off" : ""}`} /> : null}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </>
  );
}
