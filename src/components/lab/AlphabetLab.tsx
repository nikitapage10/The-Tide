"use client";
/**
 * Alphabet lab: the same phrase translated from the Tide's script into English
 * in a dozen different ways, side by side, to choose from. Each character is
 * its pair of glyphs (see components/glyphs/TideScript). Not part of the site's
 * navigation (linked from the Workshop). Under reduced motion every style shows
 * its end state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { TideGlyph, hasGlyph } from "@/components/glyphs/TideScript";

/** How one character looks at a moment: the glyph pair, and the letter. */
interface Look {
  g: React.CSSProperties | null;
  l: React.CSSProperties;
  /** Show a different (rolling) glyph pair instead of the character's own. */
  roll?: string;
}

type StyleFn = (i: number, n: number, t: number) => Look;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp(x);
  return 1 - Math.pow(1 - c, 3);
};
const ramp = (t: number, at: number, dur: number) => ease((t - at) / dur);
const fr = (x: number) => x - Math.floor(x);
const h = (i: number, k = 0) => fr(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const rollCh = (i: number, t: number, every = 0.06) => CHARS[Math.floor(h(i, Math.floor(t / every)) * CHARS.length)]!;
const hidden: React.CSSProperties = { opacity: 0 };
const shown: React.CSSProperties = { opacity: 1 };

/** Order helpers: when character i takes its turn (0..1 across the phrase). */
const centreOrder = (i: number, n: number) => Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
const randomOrder = (i: number) => h(i, 7);

const STYLES: { name: string; note: string; dur: number; fn: StyleFn; interlinear?: boolean }[] = [
  {
    name: "Random reels (on the site)",
    note: "Slot reels in random order: glyphs roll in scattered across the line, then resolve to letters in a different order.",
    dur: 3.6,
    fn: (i, n, t) => {
      const at = 0.05 * n * h(i, 11);
      const dir = [1, -1, -1, 1, -1, 1, 1][(i * 5 + n) % 7]!;
      const rolling = t >= at && t < at + 0.32;
      const res = 0.05 * n + 0.75 + 0.05 * n * h(i, 12);
      const k = ramp(t, at, 0.12);
      const r = ramp(t, res, 0.22);
      return {
        roll: rolling ? rollCh(i, t) : undefined,
        g: t < at ? null : { opacity: 0.9 * k * (1 - r), transform: `translateY(${(1 - k) * -70 * dir + r * 65 * dir}%)`, filter: `blur(${r}px)` },
        l: { opacity: r, transform: `translateY(${(1 - r) * -60 * dir}%)` },
      };
    },
  },
  {
    name: "Slot reels",
    note: "Each glyph rolls in from above or below past other glyphs, locks, then rolls out as the letter rolls in.",
    dur: 3.4,
    fn: (i, n, t) => {
      const at = 0.05 * i;
      const dir = [1, -1, -1, 1, -1, 1, 1][(i * 5 + n) % 7]!;
      const rolling = t >= at && t < at + 0.32;
      const res = 0.05 * n + 0.7 + 0.05 * i;
      const k = ramp(t, at, 0.12);
      const r = ramp(t, res, 0.22);
      return {
        roll: rolling ? rollCh(i, t) : undefined,
        g: t < at ? null : { opacity: 0.9 * k * (1 - r), transform: `translateY(${(1 - k) * -70 * dir + r * 65 * dir}%)`, filter: `blur(${r}px)` },
        l: { opacity: r, transform: `translateY(${(1 - r) * -60 * dir}%)` },
      };
    },
  },
  {
    name: "Typewriter",
    note: "Glyphs type out one by one; then the English types over them.",
    dur: 3.2,
    fn: (i, n, t) => {
      const res = 0.05 * n + 0.6 + 0.05 * i;
      return { g: t >= 0.05 * i && t < res ? shown : null, l: t >= res ? shown : hidden };
    },
  },
  {
    name: "Cascade",
    note: "Glyphs fall into place in a wave; a second wave drops them away and the letters fall in behind.",
    dur: 3.4,
    fn: (i, n, t) => {
      const k = ramp(t, 0.04 * i, 0.4);
      const r = ramp(t, 1.3 + 0.04 * i, 0.4);
      return {
        g: { opacity: 0.9 * k * (1 - r), transform: `translateY(${(1 - k) * -140 + r * 120}%)` },
        l: { opacity: r, transform: `translateY(${(1 - r) * -120}%)` },
      };
    },
  },
  {
    name: "Scramble",
    note: "Every slot cycles through glyphs at once and settles to its letter, left to right.",
    dur: 2.6,
    fn: (i, _n, t) => {
      const lock = 0.35 + 0.06 * i;
      return { roll: rollCh(i, t), g: t < lock ? { opacity: 0.85 } : null, l: t >= lock ? shown : hidden };
    },
  },
  {
    name: "Fade through",
    note: "The whole line appears in the script, holds, then dissolves into English.",
    dur: 3.2,
    fn: (_i, _n, t) => {
      const k = ramp(t, 0, 0.6);
      const r = ramp(t, 1.5, 0.9);
      return { g: { opacity: 0.9 * k * (1 - r), filter: `blur(${r * 3}px)` }, l: { opacity: r, filter: `blur(${(1 - r) * 3}px)` } };
    },
  },
  {
    name: "Card flip",
    note: "Each character is a card: glyphs on the front, the letter on the back, turned over in sequence.",
    dur: 3.2,
    fn: (i, _n, t) => {
      const k = ramp(t, 0.05 * i, 0.25);
      const flip = clamp((t - (1.1 + 0.05 * i)) / 0.35);
      const half = flip < 0.5;
      return {
        g: { opacity: 0.9 * k * (half ? 1 : 0), transform: `perspective(120px) rotateX(${(1 - k) * 90 + (half ? flip * 180 : 90)}deg)` },
        l: { opacity: half ? 0 : 1, transform: `perspective(120px) rotateX(${half ? -90 : (1 - flip) * -180}deg)` },
      };
    },
  },
  {
    name: "Centre out",
    note: "The phrase opens from its middle: glyphs first, then the translation spreads outward.",
    dur: 3,
    fn: (i, n, t) => {
      const o = centreOrder(i, n);
      const k = ramp(t, o * 0.6, 0.3);
      const r = ramp(t, 1.2 + o * 0.6, 0.3);
      return { g: { opacity: 0.9 * k * (1 - r), transform: `scale(${0.6 + 0.4 * k})` }, l: { opacity: r, transform: `scale(${0.8 + 0.2 * r})` } };
    },
  },
  {
    name: "Random order",
    note: "Glyphs surface in no order, and resolve in no order, like a signal coming clear.",
    dur: 3.2,
    fn: (i, _n, t) => {
      const o = randomOrder(i);
      const k = ramp(t, o * 0.8, 0.25);
      const r = ramp(t, 1.3 + h(i, 3) * 0.8, 0.25);
      return { g: { opacity: 0.9 * k * (1 - r) }, l: { opacity: r } };
    },
  },
  {
    name: "Scan wipe",
    note: "A reading line sweeps across: glyphs ahead of it, English behind, a glow where it reads.",
    dur: 3.4,
    fn: (i, n, t) => {
      const k = ramp(t, 0, 0.5);
      const pos = clamp((t - 1) / 1.6) * (n + 2) - 1;
      const d = i - pos;
      const read = d < 0;
      const glow = Math.exp(-d * d * 1.5);
      return {
        g: read ? null : { opacity: 0.9 * k },
        l: read ? { opacity: 1, textShadow: `0 0 ${(6 * glow).toFixed(1)}px rgba(214,226,255,${(0.9 * glow).toFixed(2)})` } : hidden,
      };
    },
  },
  {
    name: "Ink bleed",
    note: "Glyphs bleed into focus from a blur; then they soften away as the letters sharpen out of them.",
    dur: 3.4,
    fn: (i, _n, t) => {
      const k = ramp(t, 0.04 * i, 0.6);
      const r = ramp(t, 1.4 + 0.04 * i, 0.6);
      return {
        g: { opacity: 0.9 * k * (1 - r), filter: `blur(${((1 - k) * 6 + r * 4).toFixed(2)}px)`, transform: `scale(${1.5 - 0.5 * k + 0.2 * r})` },
        l: { opacity: r, filter: `blur(${((1 - r) * 5).toFixed(2)}px)` },
      };
    },
  },
  {
    name: "Interlinear",
    note: "The script stays, as an original; the English types out beneath it as a translation.",
    dur: 3.6,
    interlinear: true,
    fn: (i, n, t) => {
      const k = ramp(t, 0.04 * i, 0.3);
      const r = t >= 0.04 * n + 0.6 + 0.045 * i;
      return { g: { opacity: 0.75 * k }, l: r ? shown : hidden };
    },
  },
  {
    name: "Morph",
    note: "Each glyph pair narrows to a thread and opens out again as its letter.",
    dur: 3,
    fn: (i, _n, t) => {
      const k = ramp(t, 0.04 * i, 0.3);
      const m = clamp((t - (1.1 + 0.05 * i)) / 0.4);
      const first = m < 0.5;
      return {
        g: { opacity: 0.9 * k * (first ? 1 : 0), transform: `scaleX(${first ? 1 - m * 2 : 0})` },
        l: { opacity: first ? 0 : 1, transform: `scaleX(${first ? 0 : (m - 0.5) * 2})` },
      };
    },
  },
];

function Line({ text, fn, t, interlinear }: { text: string; fn: StyleFn; t: number; interlinear?: boolean }) {
  const chars = [...text];
  const n = chars.length;
  if (interlinear) {
    return (
      <span className="block">
        <span className="block text-white/80" style={{ ["--glyph-w" as string]: "1.15em", ["--glyph-h" as string]: "1.3em" }}>
          {chars.map((ch, i) => {
            const look = fn(i, n, t);
            return hasGlyph(ch) ? (
              <span key={i} className="relative inline-block" style={{ width: "1.15em", height: "1.3em", verticalAlign: "middle" }}>
                {look.g ? <TideGlyph ch={ch} className="absolute inset-0 m-auto" /> : null}
              </span>
            ) : (
              <span key={i} className="inline-block" style={{ width: "0.6em" }} />
            );
          })}
        </span>
        <span className="tracked mt-2 block text-[0.75rem] text-muted">
          {chars.map((ch, i) => (
            <span key={i} style={fn(i, n, t).l}>
              {ch}
            </span>
          ))}
        </span>
      </span>
    );
  }
  return (
    <span className="tracked block text-[1.35rem] leading-[2.2rem] text-white">
      {chars.map((ch, i) => {
        if (!hasGlyph(ch)) return <span key={i}>{ch}</span>;
        const look = fn(i, n, t);
        return (
          <span key={i} className="decode-cell">
            <span className="inline-block" style={{ ...look.l, transformOrigin: "50% 50%" }}>
              {ch}
            </span>
            {look.g ? (
              <span className="absolute inset-0 flex items-center justify-center" style={{ ...look.g, transformOrigin: "50% 50%" }}>
                <TideGlyph ch={look.roll ?? ch} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function AlphabetLab() {
  const [text, setText] = useState("ORIGIN UNRESOLVED");
  const [t, setT] = useState(0);
  const start = useRef(0);
  const reduced = useRef(false);
  const longest = useMemo(() => Math.max(...STYLES.map((s) => s.dur)) + 0.04 * text.length * 2, [text]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    start.current = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (reduced.current) {
        setT(99);
        return;
      }
      // Loop: play, hold the translation a moment, play again.
      const cycle = longest + 2.2;
      setT(((now - start.current) / 1000) % cycle);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [longest]);

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="tracked text-[0.62rem] text-faint">
              <a href="/workshop/alphabet-lab" className="text-white/60 no-underline hover:text-white">
                Workshop
              </a>{" "}
              / Alphabet lab
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-light">Alphabet lab</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">Thirteen ways for the Tide&apos;s script to translate into English. Each letter is its pair of glyphs.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="tracked text-[0.6rem] text-faint" htmlFor="lab-text">
              Text
            </label>
            <input
              id="lab-text"
              value={text}
              maxLength={28}
              onChange={(e) => setText(e.target.value.toUpperCase())}
              className="tracked min-h-10 w-64 border-0 border-b border-white/30 bg-transparent px-1 text-[0.75rem] text-white focus:border-white"
            />
            <button
              type="button"
              onClick={() => {
                start.current = performance.now();
              }}
              className="tracked min-h-10 border border-white/30 px-3 text-[0.62rem] text-white hover:border-white"
            >
              Replay
            </button>
          </div>
        </div>

        <ol className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-2">
          {STYLES.map((s, k) => (
            <li key={s.name} className="min-w-0 border-t border-white/10 pt-4">
              <p className="tracked flex items-baseline gap-3 text-[0.62rem] text-faint">
                <span>{String(k + 1).padStart(2, "0")}</span>
                <span className="text-white/80">{s.name}</span>
              </p>
              <div className="mt-4 min-h-[4.5rem]" aria-label={text}>
                <Line text={text || " "} fn={s.fn} t={t} interlinear={s.interlinear} />
              </div>
              <p className="mt-3 text-[0.8rem] text-muted">{s.note}</p>
            </li>
          ))}
        </ol>

        <section className="mt-16 border-t border-white/10 pt-6" aria-labelledby="chart">
          <h2 id="chart" className="tracked text-[0.62rem] text-faint">
            The alphabet
          </h2>
          <ul className="mt-5 grid grid-cols-6 gap-4 sm:grid-cols-9 md:grid-cols-12">
            {[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"].concat(["10"]).map((c) => (
              <li key={c} className="flex flex-col items-center gap-2">
                <span className="text-white/85" style={{ ["--glyph-w" as string]: "2.6em", ["--glyph-h" as string]: "2.4em", fontSize: "16px" }}>
                  <TideGlyph ch={c === "10" ? "0" : c} />
                </span>
                <span className="tracked text-[0.6rem] text-faint">{c}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
