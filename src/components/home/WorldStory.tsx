"use client";
/**
 * After the hero, the story of the world, told as you scroll: seven pinned
 * chapters that cross-fade on one stage.
 *   1 Arrival · 2 Before (the Shoreborn, the Undertow) · 3 The Veil ·
 *   4 Verdancy (the First Ascent) · 5 The Tide (its Three Consequences) ·
 *   6 The Peoples · 7 Enter (the five rooms of the site)
 * Each chapter stands in its own painted scene (public/art/story), which
 * drifts as the chapter's own progress (--t, 0..1) runs. Without
 * JavaScript, or with reduced motion, the chapters simply stack and read in
 * order.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { ConsequenceSigil } from "@/components/tide/ConsequenceSigil";
import { ArtSigil } from "@/components/tide/ArtSigil";
import { WorldName } from "@/components/tide/WorldName";
import { ART, monolith, peopleKey, peopleSigil } from "@/lib/art";
import { Narration } from "@/components/audio/Narration";
import { SpokenStage } from "@/components/audio/SpokenStage";

export interface StoryPeople {
  id: string;
  title: string;
  href: string;
  portrait: string | null;
  palette: string | null;
  epithet: string | null;
}

export interface StoryDoor {
  href: string;
  index: string;
  label: string;
  instrument: string;
  line: string;
}

const CHAPTERS = 7;

export function WorldStory({ peoples, doors, hrefs }: { peoples: StoryPeople[]; doors: StoryDoor[]; hrefs: Record<string, string | undefined> }) {
  const track = useRef<HTMLElement | null>(null);
  // -1 until the stage is live (and for good with reduced motion): every chapter shown.
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.live = "";
    let raf = 0;
    const chapters = Array.from(el.querySelectorAll<HTMLElement>("[data-chapter]"));
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      const x = p * CHAPTERS;
      el.style.setProperty("--sp", p.toFixed(4));
      let best = 0;
      chapters.forEach((c, i) => {
        // Local progress through this chapter, and how present it is (cross-fade at the joins).
        const t = Math.min(1, Math.max(0, x - i));
        const present = Math.max(0, 1 - Math.max(0, Math.abs(x - (i + 0.5)) - 0.38) / 0.16);
        c.style.setProperty("--t", t.toFixed(4));
        // Opacity only: every chapter stays readable to screen readers and reachable by keyboard.
        c.style.opacity = present.toFixed(3);
        c.style.pointerEvents = present > 0.5 ? "auto" : "none";
        if (present > 0.5) best = i;
      });
      setActive((a) => (a === best ? a : best));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    // Keyboard focus landing in a chapter that isn't showing scrolls the story to it.
    const onFocus = (e: FocusEvent) => {
      const c = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-chapter]");
      if (!c) return;
      const i = Number(c.dataset.chapter);
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      window.scrollTo({ top: window.scrollY + r.top + (span * (i + 0.5)) / CHAPTERS, behavior: "instant" as ScrollBehavior });
    };
    el.addEventListener("focusin", onFocus);
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      el.removeEventListener("focusin", onFocus);
      delete el.dataset.live;
    };
  }, []);

  const on = (i: number) => active === -1 || active === i;
  return (
    <section ref={track} className="world-story" aria-label="The story of the world" style={{ ["--chapters" as string]: CHAPTERS } as CSSProperties}>
      <div className="world-story-stage">
        {/* The planet stays in view behind the story, dim and slowly turning away. */}
        <div aria-hidden="true" className="story-planet">
          <Image src="/brand/planet-v2.webp" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        {/* 1 · Arrival */}
        <Chapter i={0} n="I" title="Arrival" scene={ART.story.arrival}>
          <p className="story-line t-display-l max-w-4xl">
            <Decode text="Breathe, little spark." active={on(0)} />
          </p>
          {/* While the narration plays, the line being spoken takes this paragraph's place, large. */}
          <SpokenStage>
            <p className="story-text">
              You have washed upon the shores of <WorldName />, adrift on currents far from your origin. A world that feels fundamentally wrong to your senses, yet strangely&hellip; resonant.
            </p>
          </SpokenStage>
          <div className="mt-10">
            <Narration />
          </div>
          <span aria-hidden="true" className="story-dust" />
        </Chapter>

        {/* 2 · Before */}
        <Chapter i={1} n="II" title="Before" scene={ART.story.before}>
          <ol className="story-years" aria-label="The last years of the Shoreborn">
            {[
              ["~2012", "Warming, documented and debated"],
              ["~2042", "Strain: resources, borders, the poor"],
              ["~2069", "A desperate surge of invention"],
              ["~2093", "A golden era, nine years long"],
              ["~2102", "The Undertow"],
            ].map(([y, l], k) => (
              <li key={y} style={{ ["--k" as string]: k } as CSSProperties}>
                <span className="font-[family-name:var(--font-mono)] text-[0.7rem] text-white/50">{y} B.U.</span>
                <span className="block text-sm text-text">{l}</span>
              </li>
            ))}
          </ol>
          <p className="story-text">
            The Shoreborn reached, and the planet answered. For nine months the world convulsed: coastlines drowned, gravity bent, and something came through from beyond. Most perished. The rest were changed.
          </p>
          {hrefs.undertow ? <More href={hrefs.undertow}>The Undertow</More> : null}
        </Chapter>

        {/* 3 · The Veil */}
        <Chapter i={2} n="III" title="The Veil" scene={ART.story.veil}>
          <p className="story-line t-display-m max-w-3xl">
            <Decode text="Some seven centuries, alone." active={on(2)} />
          </p>
          <p className="story-text">
            A long twilight. Each people became itself in isolation: some fighting to survive in the open, others suspended for generations in stone, in the abyss, in helium, in silence, their bodies slowly fusing with what held them.
          </p>
          <div className="story-sleepers" aria-hidden="true">
            {peoples.slice(0, 5).map((p, k) =>
              p.portrait ? (
                <span key={p.id} className="story-sleeper" style={{ ["--k" as string]: k } as CSSProperties}>
                  <Image src={p.portrait} alt="" fill sizes="10rem" className="object-cover" />
                </span>
              ) : null,
            )}
          </div>
          <span aria-hidden="true" className="story-fog" />
          {hrefs.veil ? <More href={hrefs.veil}>The Age of the Veil</More> : null}
        </Chapter>

        {/* 4 · Verdancy */}
        <Chapter i={3} n="IV" title="Verdancy" scene={ART.story.verdancy}>
          <p className="story-line t-display-m max-w-3xl">
            <Decode text="Five swimmers, and a girl who fell." active={on(3)} />
          </p>
          <p className="story-text">
            Carried far by a current, five young Teruānga saw a girl fall from the cliffs of an unknown island and brought her home. The isolation ended there. The Teruānga set out across the oceans, and the peoples found each other: trade, quarrels, cities in the clouds, colonies on the moon.
          </p>
          {hrefs.ascent ? <More href={hrefs.ascent}>The First Ascent</More> : null}
        </Chapter>

        {/* 5 · The Tide */}
        <Chapter i={4} n="V" title="The Tide" scene={ART.story.tide}>
          <p className="story-line t-display-m max-w-3xl">
            <Decode text="Then the Tide, and what it left behind." active={on(4)} />
          </p>
          <ol className="story-consequences">
            {(
              [
                ["drowning", "The Drowning", "Coastlines swallowed, continents rent, mountains torn loose to drift in the sky.", hrefs.drowning],
                ["divergence", "The Divergence", "Latent powers wake: gravity, time, matter, minds and energy answer new masters.", hrefs.divergence],
                ["drift", "The Drift", "Rifts open, and fragments of other times wash ashore as enclaves.", hrefs.drift],
              ] as const
            ).map(([kind, title, line, href], k) => (
              <li key={kind} style={{ ["--k" as string]: k } as CSSProperties}>
                <ConsequenceSigil kind={kind} size={56} />
                {href ? (
                  <Link href={href} className="t-title mt-4 block text-text no-underline hover:text-white">
                    {title}
                  </Link>
                ) : (
                  <span className="t-title mt-4 block">{title}</span>
                )}
                <span className="mt-2 block text-sm text-muted">{line}</span>
              </li>
            ))}
          </ol>
        </Chapter>

        {/* 6 · The Peoples */}
        <Chapter i={5} n="VI" title="The Peoples">
          <p className="story-line t-display-m max-w-3xl">
            <Decode text="Flesh with stone, light with shadow." active={on(5)} />
          </p>
          <ol className="story-procession">
            {peoples.map((p, k) => (
              <li key={p.id} style={{ ["--k" as string]: k, ...(p.palette ? { "--plate-glow": p.palette } : {}) } as CSSProperties}>
                <Link href={p.href} className="block no-underline">
                  <StoryMonolith people={p} />
                  <span className="t-title mt-3 block text-text">{p.title}</span>
                  {p.epithet ? <span className="tracked block text-[0.54rem] text-faint">{p.epithet}</span> : null}
                </Link>
              </li>
            ))}
          </ol>
        </Chapter>

        {/* 7 · Enter */}
        <Chapter i={6} n="VII" title="Enter" scene={ART.story.enter}>
          <p className="story-line t-display-m max-w-3xl">
            <Decode text="Observe, adapt, and find your place." active={on(6)} />
          </p>
          <ul className="story-doors">
            {doors.map((d, k) => (
              <li key={d.href} style={{ ["--k" as string]: k } as CSSProperties}>
                <Link href={d.href} className="story-door group block h-full no-underline">
                  <span className="tracked block text-[0.58rem] text-faint">
                    {d.index} · {d.instrument}
                  </span>
                  <span className="t-display-m mt-6 block text-text group-hover:text-white">{d.label}</span>
                  <span className="mt-3 block text-sm text-muted">{d.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Chapter>
      </div>
    </section>
  );
}

/** A people as a slab of glass holding its weather, its sigil floating on it; its portrait where there is no slab. */
function StoryMonolith({ people: p }: { people: StoryPeople }) {
  const key = peopleKey(p.title);
  const slab = monolith(key);
  const sigil = peopleSigil(key);
  if (!slab)
    return (
      <span className="story-portrait">
        {p.portrait ? <Image src={p.portrait} alt={`${p.title}, portrait`} fill sizes="12rem" className="object-cover" /> : <span className="story-portrait-empty" />}
        <span aria-hidden="true" className="plate-glow" />
      </span>
    );
  return (
    <span className="story-monolith">
      <Image src={slab} alt="" fill sizes="12rem" className="object-contain" />
      {sigil ? <ArtSigil src={sigil} size={96} className="story-monolith-sigil" /> : null}
    </span>
  );
}

function Chapter({ i, n, title, scene, children }: { i: number; n: string; title: string; scene?: string; children: ReactNode }) {
  return (
    <article className="story-chapter" data-chapter={i} aria-labelledby={`chapter-${i}`}>
      {scene ? (
        <div aria-hidden="true" className="story-scene">
          <Image src={scene} alt="" fill sizes="100vw" className="object-cover" priority={i === 0} />
        </div>
      ) : null}
      <div className="page-x story-chapter-inner">
        <h2 id={`chapter-${i}`} className="tracked flex items-center gap-3 text-[0.65rem] text-faint">
          <span className="text-white/70">{n}</span>
          <span aria-hidden="true" className="h-px w-10 bg-white/25" />
          <span>{title}</span>
        </h2>
        {children}
      </div>
    </article>
  );
}

function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="tracked story-more mt-8 inline-block text-[0.6rem] text-faint no-underline hover:text-white">
      {children} →
    </Link>
  );
}
