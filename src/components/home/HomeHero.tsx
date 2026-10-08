"use client";
/**
 * Cinematic landing: you arrive among meteors in front of the planet. Scrolling
 * pulls the camera back: both meteor layers fly outward, more of the planet is
 * revealed, and the interface fades in. Scroll progress drives one CSS variable
 * (--p, 0→1) on the sticky stage; all motion is CSS transforms from that value.
 * Reduced motion: the final composed frame, no scroll choreography.
 */
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GLYPH_PRESENCE_DEFAULT, glyphPresence } from "./GlyphTrail";
import { Decode, decodeMs } from "@/components/glyphs/Decode";
import { HeroDrifters } from "./HeroDrifters";
import { HeroScene } from "./HeroScene";
import { SoundToggle } from "./SoundToggle";

export interface HeroCallout {
  /** Position on the artwork, in percent of its width/height. */
  x: number;
  y: number;
  /** Which side of the dot the label sits on. */
  side: "left" | "right";
  title: string;
  lines: string[];
  href: string | null;
  /** Small code glyph shown under the marker (e.g. the record's ID prefix). */
  code?: string;
}

/** A rotating note: pops up at a spot on the artwork, types out, then moves on. */
export interface HeroObservation {
  x: number;
  y: number;
  side: "left" | "right";
  title: string;
  line: string;
}

export interface HeroProps {
  callouts: HeroCallout[];
  observations: HeroObservation[];
  /** Notes that pop up out in space (around the streams). */
  spaceNotes: HeroObservation[];
  /** Fixed spots on the planet where the cursor's strands are rooted. */
  spots: { x: number; y: number }[];
  /** Short machine-style readout (real data, e.g. release); currently not shown. */
  code?: string;
}

/** From the GM's intro ("The Tide - Intro"). */
const HAIKU = ["Waves crash upon shores,", "As the Tide's eternal song,", "Echoes through the void."];

const pin = (x: number, y: number) => ({ "--x": `${x}%`, "--y": `${y}%` }) as React.CSSProperties;

export function HomeHero({ callouts, observations, spaceNotes, spots }: HeroProps) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ui = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  // Marked spots on the planet, where the cursor's strands rise from.
  const anchors = useRef<{ x: number; y: number }[]>([]);
  useEffect(() => {
    anchors.current = spots;
  }, [spots]);
  const progress = useRef(0);
  // The interface (callouts) is revealed late in the scroll; it types itself in.
  const [revealed, setRevealed] = useState(false);
  // One intro clock shared by both scene layers so they fade in in sequence.
  const clock = useRef({ start: 0, ready: 0 });
  const onSceneReady = useCallback(() => stage.current?.setAttribute("data-gl", "on"), []);
  // Without WebGL, fall back to the plain image layers.
  const onSceneFail = useCallback(() => stage.current?.setAttribute("data-gl", "off"), []);
  // A storm planted by clicking the planet gets its own short-lived callout.
  const [stormNote, setStormNote] = useState<{ id: number; x: number; y: number; left: boolean; title: string; line: string } | null>(null);
  const onStorm = useCallback((x: number, y: number) => {
    const kinds = ["Plasma cell", "Ion squall", "Static bloom", "Gravitic shear", "Resonance front", "Charge vortex"];
    const classes = ["II", "III", "IV", "V"];
    const id = Date.now();
    setStormNote({
      id,
      x,
      y,
      left: x > window.innerWidth * 0.62,
      title: kinds[Math.floor(Math.random() * kinds.length)]!,
      line: `Class ${classes[Math.floor(Math.random() * classes.length)]} · forming`,
    });
    window.setTimeout(() => setStormNote((n) => (n && n.id === id ? null : n)), 6000);
  }, []);
  // A disturbance in open space gets the same kind of short-lived callout.
  const onGravity = useCallback((x: number, y: number) => {
    const kinds: [string, string][] = [
      ["Gravity ripple", "Faint, passing"],
      ["Mass shadow", "Source unseen"],
      ["Lensing", "Light bent, briefly"],
      ["Tidal shear", "Weak, local"],
    ];
    const [title, line] = kinds[Math.floor(Math.random() * kinds.length)]!;
    const id = Date.now();
    setStormNote({ id, x, y, left: x > window.innerWidth * 0.62, title, line });
    window.setTimeout(() => setStormNote((n) => (n && n.id === id ? null : n)), 5000);
  }, []);

  useEffect(() => {
    const t = track.current;
    const s = stage.current;
    if (!t || !s) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.style.setProperty("--p", "1");
      overlay.current?.style.setProperty("--p", "1");
      progress.current = 1;
      ui.current?.setAttribute("data-hidden", "false");
      const id = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = t.getBoundingClientRect();
      // The last stretch of the track is a hold: the finished frame rests a moment
      // before the page continues.
      const hold = 0.5 * window.innerHeight;
      const span = Math.max(1, rect.height - window.innerHeight - hold);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      s.style.setProperty("--p", p.toFixed(4));
      overlay.current?.style.setProperty("--p", p.toFixed(4));
      progress.current = p;
      // Sparse glyphs before you scroll, more present as you scroll in.
      glyphPresence.current = 0.15 + 0.85 * p;
      ui.current?.setAttribute("data-hidden", p < 0.45 ? "true" : "false");
      setRevealed(p >= 0.5);
      // The header gets its backdrop back once the hero has scrolled away.
      document.body.dataset.pastHero = rect.bottom <= 64 ? "true" : "false";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      delete document.body.dataset.pastHero;
      glyphPresence.current = GLYPH_PRESENCE_DEFAULT;
    };
  }, [progress]);


  return (
    <section ref={track} className="hero-track" aria-labelledby="hero-title">
      {/* Stacking, back to front: scene (WebGL, or DOM layers as fallback), interface, title. */}
      <div ref={stage} className="hero-stage">
        <div className="hero-frame hero-dom z-0">
          <div className="hero-layer hero-planet hero-planet-dom">
            <div className="hero-land hero-land-3 absolute inset-0">
              <Image src="/brand/planet-v2.webp" alt="" fill priority sizes="100vw" className="object-cover" />
            </div>
          </div>
        </div>

        {/* WebGL scene: planet + meteors + gravity lens (replaces the DOM layers when available). */}
        <HeroScene layer="planet" progress={progress} clock={clock} onReady={onSceneReady} onFail={onSceneFail} onStorm={onStorm} onGravity={onGravity} tip={tip} anchors={anchors} className="hero-layer z-[1] h-full w-full" />

        {/* Things passing through: orbiters on the dashed orbit, debris drifting by. */}
        <HeroDrifters progress={progress} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />

        {/* Orbit (scales with the planet) and callouts/glyphs (pinned to the art, constant size). */}
        <div ref={ui} data-hidden="true" className="hero-ui pointer-events-none absolute inset-0 z-[2] hidden sm:block">
          <div className="hero-frame">
            <div className="hero-layer hero-planet">
              <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <ellipse cx="88" cy="62" rx="40" ry="60" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="1 6" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            {/* Tiny bodies on the orbit: decorative markers only. */}
            {[
              [48.5, 55],
              [54, 88],
            ].map(([x, y]) => (
              <span key={`${x}`} aria-hidden="true" className="hero-pin -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-white/60" style={pin(x!, y!)} />
            ))}
            {/* Crosshairs */}
            {[
              [30, 66],
              [60, 18],
            ].map(([x, y]) => (
              <span key={`c${x}`} aria-hidden="true" className="hero-pin -ml-2 -mt-2 font-[family-name:var(--font-mono)] text-base leading-4 text-white/35" style={pin(x!, y!)}>
                +
              </span>
            ))}
            {callouts.map((c, i) => (
              <div key={c.title} className="hero-pin" style={pin(c.x, c.y)}>
                <Callout c={c} active={revealed} delay={i * 450} />
              </div>
            ))}
            <Observations items={observations} active={revealed} />
            <Observations items={spaceNotes} active={revealed} startDelay={4800} calc />
          </div>
          {/* Top-right note from the mockup. */}
          <div className="absolute right-4 top-[calc(var(--header-h)+1rem)] flex items-center gap-3 sm:right-10">
            <span className="tracked text-right text-[0.6rem] leading-4 text-faint">
              A quieter universe
              <br />
              awaits
            </span>
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-white/60" />
          </div>
        </div>

        {/* Screen-anchored interface: scroll cue and footer line. */}
        <div className="page-x pointer-events-none absolute inset-0 z-[3] flex flex-col justify-end pb-6">
          <div className="hero-ui tracked flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[0.68rem] text-faint">
            <span className="flex items-center gap-4">
              A living atlas of worlds <span aria-hidden="true" className="hidden h-px w-14 bg-white/25 sm:inline-block" /> The Tide
            </span>
          </div>
        </div>

        {/* Meteors in front of the interface. */}
        <div className="hero-frame hero-dom pointer-events-none z-[4]">
          <div className="hero-layer hero-far">
            <div className="hero-land hero-land-2 absolute inset-0">
              <Image src="/brand/meteors-far.webp" alt="" fill sizes="100vw" className="object-cover" />
            </div>
          </div>
          <div className="hero-layer hero-near">
            <div className="hero-land absolute inset-0">
              <Image src="/brand/meteors-near.webp" alt="" fill sizes="100vw" className="object-cover" />
            </div>
          </div>
        </div>
        <div className="hero-vignette pointer-events-none absolute inset-0 z-[5]" />

        {/* Title: in front of the DOM fallback meteors; behind the WebGL meteors. */}
        <div className="page-x pointer-events-none absolute inset-x-0 top-0 z-[6] pt-[calc(var(--header-h)+2.5rem)]">
          <div className="hero-title">
            <p className="tracked flex items-center gap-3 text-faint">
              <span>01 / Home</span>
              <span aria-hidden="true" className="h-px w-20 bg-white/25" />
            </p>
            <h1 id="hero-title" className="mt-8 whitespace-nowrap font-[family-name:var(--font-display)] text-[clamp(2.6rem,7.4vw,9rem)] font-light uppercase leading-none tracking-[0.32em] text-white sm:tracking-[0.42em]">
              The Tide
            </h1>
          </div>
        </div>

        <div ref={tip} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-[6] opacity-0">
          <Locator />
        </div>

        {stormNote ? (
          <div key={stormNote.id} aria-hidden="true" className="obs obs-on pointer-events-none absolute z-[6]" style={{ left: stormNote.x, top: stormNote.y }}>
            <span className="obs-ping absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white/70" />
            <span className="absolute -left-[2px] -top-[2px] h-1 w-1 rounded-full bg-white" />
            <span className={`obs-line absolute top-0 h-px bg-white/50 ${stormNote.left ? "right-2 origin-right" : "left-2 origin-left"}`} />
            <div className={`absolute -top-2.5 w-max ${stormNote.left ? "right-[4.5rem] text-right" : "left-[4.5rem]"}`}>
              <span className="tracked block text-white">
                <Decode text={stormNote.title} active delay={150} calc />
              </span>
              <span className="tracked block text-[0.68rem] leading-5 text-muted">
                <Decode text={stormNote.line} active delay={150 + decodeMs(stormNote.title, true) * 0.55} />
              </span>
            </div>
          </div>
        ) : null}

        {/* The haiku from the GM's intro, set low along the streams of light. */}
        <div className="page-x pointer-events-none absolute inset-x-0 bottom-[16%] z-[6] hidden sm:block">
          <p className="hero-haiku max-w-sm font-[family-name:var(--font-display)] text-[clamp(1rem,0.8rem+0.5vw,1.45rem)] italic leading-relaxed text-white/70">
            {HAIKU.map((line, i) => (
              <span key={line} className="block">
                <Typed text={line} active={revealed} delay={600 + i * 1100} speed={45} />
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* WebGL meteors over everything, the header and title included. A separate
          sticky layer (the stage's own stacking context sits under the header): as you
          scroll in, the near rocks rise past the text and leave the frame by the end. */}
      <div ref={overlay} className="hero-overlay">
        <HeroScene layer="meteors" progress={progress} clock={clock} onFail={onSceneFail} className="h-full w-full" />
        {/* Scroll cue: arrives after the intro, gone as soon as you start scrolling. */}
        <div aria-hidden="true" className="hero-cue tracked absolute inset-x-0 bottom-7 flex flex-col items-center gap-3 text-[0.62rem] text-white/60">
          <span>Scroll</span>
          <span className="hero-cue-line block h-9 w-px overflow-hidden bg-white/15" />
        </div>
        <SoundToggle className="tracked pointer-events-auto absolute bottom-7 right-4 flex min-h-10 items-center gap-2 px-2 text-[0.6rem] text-white/60 hover:text-white sm:right-10" />
      </div>
    </section>
  );
}

/** Text that types itself out while `active` (instantly under reduced motion). */
function Typed({ text, active, delay = 0, speed = 28 }: { text: string; active: boolean; delay?: number; speed?: number }) {
  const [typed, setN] = useState(0);
  let n = typed;
  useEffect(() => {
    if (!active) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0;
    let timer = 0;
    const start = window.setTimeout(() => {
      setN(instant ? text.length : 0);
      if (instant) return;
      timer = window.setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) window.clearInterval(timer);
      }, speed);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [active, text, delay, speed]);
  // Hidden: nothing typed (derived, so no state reset is needed).
  if (!active) n = 0;
  const done = n >= text.length;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {active && !done ? <span className="typed-caret">▍</span> : null}
        <span className="invisible">{text.slice(n)}</span>
      </span>
    </>
  );
}

/** One note at a time, cycling through the list at different spots on the planet. */
function Observations({ items, active, startDelay = 1600, calc = false }: { items: HeroObservation[]; active: boolean; startDelay?: number; calc?: boolean }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active || items.length === 0) return;
    let alive = true;
    let t1 = 0;
    let t2 = 0;
    const cycle = (i: number) => {
      setIndex(i);
      setShown(true);
      t1 = window.setTimeout(() => {
        if (!alive) return;
        setShown(false);
        t2 = window.setTimeout(() => alive && cycle((i + 1) % items.length), 900);
      }, 6200);
    };
    const t0 = window.setTimeout(() => cycle(index), startDelay);
    return () => {
      alive = false;
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Restart the cycle only when revealed/hidden; index continues where it was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items.length, startDelay]);
  const o = items[index];
  if (!o) return null;
  const on = active && shown;
  return (
    <div aria-hidden="true" className={`hero-pin obs ${on ? "obs-on" : ""}`} style={pin(o.x, o.y)}>
      <span className="obs-ping absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white/70" />
      <span className="absolute -left-[2px] -top-[2px] h-1 w-1 rounded-full bg-white" />
      <span className={`obs-line absolute top-0 h-px bg-white/50 ${o.side === "right" ? "left-2 origin-left" : "right-2 origin-right"}`} />
      <div className={`absolute -top-2.5 w-max max-w-[16rem] ${o.side === "right" ? "left-[4.5rem]" : "right-[4.5rem] text-right"}`}>
        {/* Identified first (working), written in the script, then translated. */}
        {calc ? <Working key={`w${index}`} active={on} seed={index} /> : null}
        <span className="tracked block text-white">
          <Decode key={`t${index}`} text={o.title} active={on} delay={(calc ? WORKING_MS : 0) + 250} calc={!calc} />
        </span>
        <span className="tracked block text-[0.68rem] leading-5 text-muted">
          <Decode key={`l${index}`} text={o.line} active={on} delay={(calc ? WORKING_MS : 0) + 250 + decodeMs(o.title, !calc) * 0.55} />
        </span>
      </div>
    </div>
  );
}

/** Made-up glyphs (the same family as the glyph panel), mixed into the working. */
const GLYPHS = ["⟁", "⋎", "⍙", "⊼", "⨯", "⟊", "⌖", "⍜", "⟟", "⏃"];
const OPS = ["∫", "Σ", "Δ", "∂", "√", "λ", "θ", "≈", "∝", "∇"];

const WORKING_MS = 1500;

/**
 * Two lines of "working" where a note in space will appear: formulas mixing
 * maths and the made-up glyphs churn as the object is identified, lock in,
 * then clear so the name can type out in their place.
 */
function Working({ active, seed }: { active: boolean; seed: number }) {
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
    const num = () => (Math.random() * 9.99).toFixed(3);
    const line = () => `${pick(OPS)}${pick(GLYPHS)} ${num()} ${pick(["·", "×", "→"])} ${pick(GLYPHS)}${pick(GLYPHS)} ${num()}`;
    const final = [line(), line()];
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setLines([0, 1].map((i) => (ticks > 9 + i * 4 ? final[i]! : line())).slice(0, ticks > 3 ? 2 : 1));
      if (ticks * 70 >= WORKING_MS) {
        window.clearInterval(timer);
        setDone(true);
      }
    }, 70);
    return () => window.clearInterval(timer);
  }, [active, seed]);
  if (!active || done) return null;
  return (
    <span className="absolute inset-x-0 top-0 block font-[family-name:var(--font-mono)] text-[0.6rem] leading-4 tracking-[0.12em] text-white/40">
      {lines.map((l, i) => (
        <span key={i} className="block whitespace-nowrap">
          {l}
        </span>
      ))}
    </span>
  );
}

/**
 * Readout at the ribbons' tip: as if the strands were locating something,
 * lines of working in maths and the made-up script churn, and a fix converges.
 */
function Locator() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
    const num = (d = 3) => (Math.random() * 9.99).toFixed(d);
    let fix = [Math.random() * 180 - 90, Math.random() * 360 - 180];
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      // The fix wanders, then settles, then a new search begins.
      const settle = Math.min(1, (n % 60) / 40);
      if (n % 60 === 0) fix = [Math.random() * 180 - 90, Math.random() * 360 - 180];
      const jitter = (1 - settle) * 4;
      const la = fix[0]! + (Math.random() - 0.5) * jitter;
      const lo = fix[1]! + (Math.random() - 0.5) * jitter;
      setLines([
        `${pick(GLYPHS)}${pick(GLYPHS)} ${settle < 1 ? "locating" : "fixed"}`,
        `${pick(OPS)}${pick(GLYPHS)} ${num()} ${pick(["·", "×", "→"])} ${pick(GLYPHS)} ${num(2)}`,
        `${la >= 0 ? "+" : "−"}${Math.abs(la).toFixed(3)} ${pick(GLYPHS)} ${lo >= 0 ? "+" : "−"}${Math.abs(lo).toFixed(3)}`,
      ]);
    }, 110);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="absolute left-5 top-3 block font-[family-name:var(--font-mono)] text-[0.58rem] leading-4 tracking-[0.12em] text-white/45">
      {lines.map((l, i) => (
        <span key={i} className={`block whitespace-nowrap ${i === 2 ? "text-white/70" : ""}`}>
          {l}
        </span>
      ))}
    </span>
  );
}

function Callout({ c, active, delay }: { c: HeroCallout; active: boolean; delay: number }) {
  const body = (
    <>
      <span className="tracked block text-white">
        <Decode text={c.title} active={active} delay={delay} calc />
      </span>
      {c.lines.map((l) => (
        <span key={l} className="tracked block text-[0.68rem] leading-5 text-muted">
          <Decode text={l} active={active} delay={delay + decodeMs(c.title, true) * 0.55} />
        </span>
      ))}
    </>
  );
  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white/80">
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      </span>
      <span aria-hidden="true" className={`absolute top-0 h-px w-14 bg-white/50 ${c.side === "right" ? "left-2" : "right-2"}`} />
      {c.code ? (
        <span aria-hidden="true" className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap font-[family-name:var(--font-mono)] text-[0.58rem] tracking-[0.2em] text-white/40">
          {c.code}
        </span>
      ) : null}
      <div className={`absolute -top-2.5 w-max max-w-[16rem] ${c.side === "right" ? "left-[4.5rem]" : "right-[4.5rem] text-right"}`}>
        {c.href ? (
          <Link href={c.href} tabIndex={-1} className="pointer-events-auto block no-underline">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
    </div>
  );
}
