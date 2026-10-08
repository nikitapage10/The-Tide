"use client";
/**
 * Interactive pieces for the section sub-pages: the history scroll (a line
 * drawn as you read, with a year counter that runs), live phenomena (the
 * hero's particle effects, large), the peoples carousel (one people per
 * screen, parallax), and decode-on-hover labels.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { CalloutFx, type FxKind } from "@/components/home/CalloutFx";
import { useScrollProgress } from "@/components/motion/useScrollProgress";
import { ArtSigil } from "@/components/tide/ArtSigil";
import { glyph } from "@/lib/art";

/** Re-decodes its text each time it is hovered or focused (and once on arrival). */
export function HoverDecode({ text, className = "" }: { text: string; className?: string }) {
  const [k, setK] = useState(0);
  return (
    <span className={className} onMouseEnter={() => setK((v) => v + 1)} onFocus={() => setK((v) => v + 1)}>
      <Decode key={k} text={text} active />
    </span>
  );
}

/** True once the element has been on screen (and while it is, if `live`). */
function useSeen<T extends HTMLElement>(live = false) {
  const ref = useRef<T | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      const vis = e.some((x) => x.isIntersecting);
      if (live) setOn(vis);
      else if (vis) {
        setOn(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [live]);
  return [ref, on] as const;
}

/** A large live particle field (the hero's callout effects, scaled up). Runs only while visible. */
export function LiveFx({ kind, scale = 3, className = "" }: { kind: FxKind; scale?: number; className?: string }) {
  const [ref, on] = useSeen<HTMLDivElement>(true);
  return (
    <div ref={ref} aria-hidden="true" className={`live-fx ${className}`}>
      <div className="live-fx-inner" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="relative h-0 w-0">
          <CalloutFx kind={kind} on={on} />
        </div>
      </div>
    </div>
  );
}

export interface HistoryItem {
  id: string;
  href: string;
  title: string;
  summary: string | null;
  label: string | null;
  era: string | null;
  eraLabel: string | null;
  year: number;
  certainty: string;
  people: string | null;
}

/**
 * History, read downward: a spine that draws itself as you scroll, events
 * stepping out to either side, and a large counter that runs to each event's
 * place in time as it comes into view.
 */
export function HistoryScroll({ items }: { items: HistoryItem[] }) {
  const track = useRef<HTMLDivElement | null>(null);
  useScrollProgress(track, { mode: "cross", name: "--draw" });
  const [year, setYear] = useState(items[0]?.year ?? 0);
  const [era, setEra] = useState(items[0]?.eraLabel ?? "");
  useEffect(() => {
    const els = Array.from(track.current?.querySelectorAll<HTMLElement>("[data-year]") ?? []);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.dataset.lit = "";
          setYear(Number(el.dataset.year));
          setEra(el.dataset.era ?? "");
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  // The counter eases toward the year in view.
  const [shown, setShown] = useState(year);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setShown((v) => {
        const d = year - v;
        if (Math.abs(d) < 0.5) return year;
        raf = requestAnimationFrame(step);
        return v + d * 0.12;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [year]);
  return (
    <div ref={track} className="history-scroll relative grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside aria-hidden="true" className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-h)+6rem)]">
          <p className="tracked text-[0.6rem] text-faint">{era}</p>
          <p className="history-counter mt-2">{Math.round(shown)}</p>
          <p className="tracked mt-1 text-[0.58rem] text-faint">reckoned in B.U. years and onward</p>
        </div>
      </aside>
      <ol className="relative">
        <span aria-hidden="true" className="history-spine" />
        {items.map((it, i) => (
          <li key={it.id} data-year={it.year} data-era={it.eraLabel ?? ""} className={`history-item ${i % 2 ? "history-right" : "history-left"}`}>
            <span aria-hidden="true" className="history-node" data-certainty={it.certainty} />
            <Link href={it.href} className="history-card block no-underline">
              <span className="block font-[family-name:var(--font-mono)] text-[0.62rem] tracking-[0.14em] text-faint">
                {it.label ?? ""}
                {it.people ? ` · ${it.people}` : ""}
              </span>
              <span className="t-display-m mt-2 block text-text">{it.title}</span>
              {it.summary ? <span className="mt-3 block text-sm leading-relaxed text-muted">{it.summary}</span> : null}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface CarouselPeople {
  id: string;
  href: string;
  title: string;
  epithet: string | null;
  summary: string | null;
  portrait: string | null;
  palette: string | null;
  factions: string[];
  index: number;
  /** Art: the people's sigil, and its homeland to stand in. */
  sigil?: string | null;
  homeland?: string | null;
}

/** One people per screen, snapping sideways; the portrait drifts against the text. */
export function PeoplesCarousel({ peoples }: { peoples: CarouselPeople[] }) {
  const strip = useRef<HTMLOListElement | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const w = el.clientWidth;
        el.querySelectorAll<HTMLElement>("[data-slide]").forEach((s) => {
          const off = (s.offsetLeft - el.scrollLeft) / w; // -1..1 around the current slide
          s.style.setProperty("--off", off.toFixed(3));
        });
        setAt(Math.round(el.scrollLeft / w));
      });
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const go = (d: number) => strip.current?.scrollBy({ left: d * (strip.current?.clientWidth ?? 0), behavior: "smooth" });
  return (
    <div className="peoples-carousel relative">
      <ol ref={strip} className="carousel-strip flex overflow-x-auto" aria-label="The peoples">
        {peoples.map((p) => (
          <li key={p.id} data-slide className="carousel-slide relative w-full shrink-0" style={(p.palette ? { "--plate-glow": p.palette } : {}) as CSSProperties}>
            {p.homeland ? (
              <div aria-hidden="true" className="carousel-homeland">
                <Image src={p.homeland} alt="" fill sizes="100vw" className="object-cover" />
              </div>
            ) : null}
            <div className="relative grid h-full items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="carousel-portrait relative mx-auto aspect-[3/4] w-full max-w-[26rem] overflow-hidden">
                {p.portrait ? <Image src={p.portrait} alt={`${p.title}, portrait`} fill sizes="(min-width: 768px) 26rem, 80vw" className="object-cover" /> : <span className="carousel-empty" />}
                <span aria-hidden="true" className="plate-glow" />
              </div>
              <div className="carousel-text min-w-0">
                <p className="font-[family-name:var(--font-mono)] text-[0.7rem] text-faint">{String(p.index).padStart(2, "0")} / {String(peoples.length).padStart(2, "0")}</p>
                {p.sigil ? <ArtSigil src={p.sigil} size={72} className="carousel-sigil mt-5" /> : null}
                <h2 className="t-display-xl mt-3">{p.title}</h2>
                {p.epithet ? <p className="tracked mt-3 text-[0.62rem] text-faint">{p.epithet}</p> : null}
                {p.summary ? <p className="t-lede mt-6 max-w-xl">{p.summary}</p> : null}
                {p.factions.length ? (
                  <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1">
                    {p.factions.map((f) => (
                      <span key={f} className="tracked text-[0.58rem] text-muted">
                        {f}
                      </span>
                    ))}
                  </p>
                ) : null}
                <Link href={p.href} className="tracked mt-8 inline-block border-b border-white/30 pb-1 text-[0.62rem] text-white no-underline hover:border-white">
                  Open the folio →
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-hidden="true">
          {peoples.map((p, i) => (
            <span key={p.id} className={`h-px w-6 ${i === at ? "bg-white" : "bg-white/20"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => go(-1)} className="carousel-btn" aria-label="Previous people">
            <Image src={glyph("arrow-left")} alt="" width={40} height={40} />
          </button>
          <button type="button" onClick={() => go(1)} className="carousel-btn" aria-label="Next people">
            <Image src={glyph("arrow-right")} alt="" width={40} height={40} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** A tilt that follows the pointer (for covers and cards). */
export function Tilt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rx", `${(((e.clientY - r.top) / r.height - 0.5) * -10).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width - 0.5) * 14).toFixed(2)}deg`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt ${className}`}>
      {children}
    </div>
  );
}
