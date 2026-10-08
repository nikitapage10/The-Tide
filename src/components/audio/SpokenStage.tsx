"use client";
/**
 * The narration, spoken large: while the Arrival narration plays, the line
 * being read is set in display type where the chapter's text was. Each word
 * surfaces in the Tide's script as it is spoken and resolves into English
 * (Decode), flaring as it lands (the read-along's lens flare); when the line
 * ends it lifts away and the next takes its place.
 *
 * The lines are the caption cues (already corrected: Ilyr, the Tide...); the
 * words inside each line are timed from the recording's word timings, matched
 * the same way as the read-along. The narration's audio is found through the
 * `tide:narration` event, so this can sit anywhere on the page.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Decode, decodeDoneMs } from "@/components/glyphs/Decode";
import { timeWords, wordAt, type TimedWord } from "./karaoke";

const CAPTIONS = "/audio/ilyr-narration.vtt";
const WORDS = "/audio/ilyr-narration.words.json";
/** The pace of a spoken word's decode (ms a step, steps held). */
const TICK = 8;
const HOLD = 1;

interface Line {
  start: number;
  end: number;
  words: string[];
  starts: number[];
  ends: number[];
  /** When each word begins to decode: its own decode time before it is heard, so every word resolves as it is spoken, short or long. */
  shows: number[];
}

const seconds = (stamp: string) => stamp.split(":").reduce((s, part) => s * 60 + Number(part), 0);

/** The cues of a WebVTT file: start, end, text. */
export function parseVtt(vtt: string): { start: number; end: number; text: string }[] {
  return vtt
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const at = lines.findIndex((l) => l.includes("-->"));
      if (at < 0) return null;
      const [a, b] = lines[at]!.split("-->").map((x) => x.trim().split(" ")[0]!);
      return { start: seconds(a!), end: seconds(b!), text: lines.slice(at + 1).join(" ").trim() };
    })
    .filter((c): c is { start: number; end: number; text: string } => !!c && !!c.text);
}

/** Lines with each word timed: the recording's words that fall within the cue, matched to its text. */
export function buildLines(cues: { start: number; end: number; text: string }[], timed: TimedWord[]): Line[] {
  return cues.map((c) => {
    const words = c.text.split(/\s+/).filter(Boolean);
    const near = timed.filter((t) => t[0] >= c.start - 0.4 && t[0] <= c.end + 0.2);
    const { starts, ends } = near.length ? timeWords(words, near, c.start) : { starts: words.map((_, i) => c.start + ((c.end - c.start) * i) / words.length), ends: words.map((_, i) => c.start + ((c.end - c.start) * (i + 0.8)) / words.length) };
    const shows = words.map((w, i) => starts[i]! - decodeDoneMs(w, TICK, HOLD) / 1000);
    for (let i = 1; i < shows.length; i++) if (shows[i]! < shows[i - 1]!) shows[i] = shows[i - 1]!;
    return { start: c.start, end: c.end, words, starts, ends, shows };
  });
}

export function SpokenStage({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [lines, setLines] = useState<{ all: Line[]; starts: number[] } | null>(null);
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState<{ line: number; word: number; lit: number }>({ line: -1, word: -1, lit: -1 });

  // The narration announces itself (and its audio element) when it plays or stops.
  useEffect(() => {
    const onNarration = (e: Event) => {
      const d = (e as CustomEvent<{ playing: boolean; audio?: HTMLAudioElement; open?: boolean }>).detail;
      if (d.audio) audio.current = d.audio;
      setPlaying(d.playing);
      if (d.open === false) {
        setOn(false);
        setAt({ line: -1, word: -1, lit: -1 });
      } else if (d.playing) setOn(true);
    };
    window.addEventListener("tide:narration", onNarration);
    return () => window.removeEventListener("tide:narration", onNarration);
  }, []);

  // Lines and timings, fetched the first time the narration plays.
  useEffect(() => {
    if (!on || lines) return;
    let cancelled = false;
    void Promise.all([fetch(CAPTIONS).then((r) => r.text()), fetch(WORDS).then((r) => r.json() as Promise<TimedWord[]>)])
      .then(([vtt, timed]) => {
        if (cancelled) return;
        const all = buildLines(parseVtt(vtt), timed);
        // A line opens when its first word starts decoding.
        setLines({ all, starts: all.map((l) => l.shows[0] ?? l.start) });
      })
      .catch(() => {
        /* no timings: the chapter keeps its own text */
      });
    return () => {
      cancelled = true;
    };
  }, [on, lines]);

  // Follow the voice, frame by frame, while it plays.
  useEffect(() => {
    if (!playing || !lines) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const a = audio.current;
      if (!a) return;
      const t = a.currentTime;
      // The line being spoken (or the last one, through the pause after it).
      // A line opens as its first word begins to decode.
      const line = wordAt(lines, t);
      const l = lines.all[line];
      // Words shown: those whose decode has begun. The flare: the word being heard.
      const word = l ? wordAt({ starts: l.shows }, t) : -1;
      const heard = l ? wordAt(l, t) : -1;
      const lit = !!l && heard >= 0 && t < l.ends[heard]! + 0.3 ? heard : -1;
      setAt((p) => (p.line === line && p.word === word && p.lit === lit ? p : { line, word, lit }));
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, lines]);

  const ls = lines?.all;
  const line = ls && at.line >= 0 ? ls[at.line] : null;
  const prev = ls && at.line > 0 ? ls[at.line - 1] : null;
  return (
    <div className="spoken-wrap" data-on={on && line ? "" : undefined}>
      <div className="spoken-own">{children}</div>
      <div className="spoken-stage" aria-hidden="true">
        {prev ? (
          <p key={`p${at.line - 1}`} className="spoken-prev">
            {prev.words.join(" ")}
          </p>
        ) : null}
        {line ? (
          <p key={`l${at.line}`} className="spoken-line">
            {line.words.map((w, k) => (
              <span key={k} className={`spoken-word ${k <= at.word ? "spoken-said" : ""} ${k === at.lit ? "spoken-now" : ""}`}>
                <Decode text={w} active={k <= at.word} tick={TICK} hold={HOLD} />{" "}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
