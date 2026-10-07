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
import { useEffect, useRef } from "react";
import { GravityField } from "./GravityField";

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

export interface HeroProps {
  callouts: HeroCallout[];
  /** Short machine-style readout under the glyph panel (real data, e.g. release). */
  code: string;
}

const pin = (x: number, y: number) => ({ "--x": `${x}%`, "--y": `${y}%` }) as React.CSSProperties;

export function HomeHero({ callouts, code }: HeroProps) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ui = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = track.current;
    const s = stage.current;
    if (!t || !s) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.style.setProperty("--p", "1");
      ui.current?.setAttribute("data-hidden", "false");
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = t.getBoundingClientRect();
      const span = Math.max(1, rect.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      s.style.setProperty("--p", p.toFixed(4));
      ui.current?.setAttribute("data-hidden", p < 0.45 ? "true" : "false");
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
    };
  }, []);

  const skip = () => {
    const t = track.current;
    if (t) window.scrollTo({ top: t.offsetTop + t.offsetHeight - window.innerHeight, behavior: "smooth" });
  };

  return (
    <section ref={track} className="hero-track" aria-labelledby="hero-title">
      {/* Stacking, back to front: planet, lens, interface, meteors, title. */}
      <div ref={stage} className="hero-stage">
        <div className="hero-frame z-0">
          <div className="hero-layer hero-planet">
            <div className="hero-land absolute inset-0">
              <Image src="/brand/planet.webp" alt="" fill priority sizes="100vw" className="object-cover" />
            </div>
          </div>
        </div>

        <GravityField className="hero-layer z-[1] h-full w-full" />

        {/* Orbit (scales with the planet) and callouts/glyphs (pinned to the art, constant size). */}
        <div ref={ui} data-hidden="true" className="hero-ui pointer-events-none absolute inset-0 z-[2] hidden sm:block">
          <div className="hero-frame">
            <div className="hero-layer hero-planet">
              <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <ellipse cx="82" cy="53" rx="40" ry="55" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="1 6" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            {/* Tiny bodies on the orbit: decorative markers only. */}
            {[
              [42.5, 58],
              [47, 80],
            ].map(([x, y]) => (
              <span key={`${x}`} aria-hidden="true" className="hero-pin -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-white/60" style={pin(x!, y!)} />
            ))}
            {/* Crosshairs */}
            {[
              [52, 62],
              [68.25, 73.25],
            ].map(([x, y]) => (
              <span key={`c${x}`} aria-hidden="true" className="hero-pin -ml-2 -mt-2 font-[family-name:var(--font-mono)] text-base leading-4 text-white/35" style={pin(x!, y!)}>
                +
              </span>
            ))}
            {callouts.map((c) => (
              <div key={c.title} className="hero-pin" style={pin(c.x, c.y)}>
                <Callout c={c} />
              </div>
            ))}
          </div>
          {/* Glyph panel, bottom right (decorative script, no meaning). */}
          <div aria-hidden="true" className="absolute bottom-24 right-4 font-[family-name:var(--font-mono)] text-white/70 sm:right-10">
            <div className="flex items-center gap-3 border-x border-white/40 px-3 py-1 text-sm tracking-[0.5em]">⟁ ⋎ ⍙ ⊼ ⨯ ⟊</div>
            <div className="tracked mt-2 border-l border-white/40 pl-3 text-[0.62rem] text-faint">{code}</div>
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
        <div className="pointer-events-none absolute inset-0 z-[3] mx-auto flex max-w-[96rem] flex-col justify-end px-4 pb-6 sm:px-10">
          <button type="button" onClick={skip} className="hero-cue tracked pointer-events-auto mb-10 flex w-max flex-col items-center gap-3 text-faint hover:text-white">
            <span aria-hidden="true" className="h-20 w-px bg-white/25" />
            <span aria-hidden="true" className="h-3 w-3 rounded-full border border-white/70" />
            <span className="leading-5">
              Scroll
              <br />
              inward
            </span>
          </button>
          <div className="hero-ui tracked flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[0.68rem] text-faint">
            <span className="flex items-center gap-4">
              A living atlas of worlds <span aria-hidden="true" className="hidden h-px w-14 bg-white/25 sm:inline-block" /> The Tide
            </span>
            <span>Observe / Discover / Preserve</span>
          </div>
        </div>

        {/* Meteors in front of the interface. */}
        <div className="hero-frame pointer-events-none z-[4]">
          <div className="hero-layer hero-far">
            <div className="hero-land-late absolute inset-0">
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

        {/* Title: the only element in front of the meteors. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] mx-auto max-w-[96rem] px-4 pt-[calc(var(--header-h)+2.5rem)] sm:px-10">
          <div className="hero-land-late max-w-xl">
            <p className="tracked flex items-center gap-3 text-faint">
              <span>01 / Home</span>
              <span aria-hidden="true" className="h-px w-20 bg-white/25" />
            </p>
            <h1 id="hero-title" className="mt-8 font-[family-name:var(--font-display)] text-5xl font-light uppercase tracking-[0.42em] text-white sm:text-7xl">
              The Tide
            </h1>
            <p className="tracked mt-5 text-muted">Worlds in equilibrium</p>
            <p className="tracked mt-8 leading-8 text-faint">
              <span className="block">Gravity writes.</span>
              <span className="block">Worlds respond.</span>
              <span className="block">We listen.</span>
            </p>
            <span aria-hidden="true" className="mt-6 block h-px w-8 bg-white/50" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Callout({ c }: { c: HeroCallout }) {
  const body = (
    <>
      <span className="tracked block text-white">{c.title}</span>
      {c.lines.map((l) => (
        <span key={l} className="tracked block text-[0.68rem] leading-5 text-muted">
          {l}
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
