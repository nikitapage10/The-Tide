"use client";
/**
 * The Arrival, read aloud: a "Listen" control in the home story's first
 * chapter and on the Arrival page in the Library. Once it
 * starts, a slim bar docks to the foot of the screen (so the story can be
 * scrolled while it plays) with the line being spoken, a seek line and the
 * time. Never plays on its own. The hero's sound steps back while it speaks
 * (`tide:narration`).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SRC = "/audio/ilyr-narration.mp3";
const CAPTIONS = "/audio/ilyr-narration.vtt";
const LENGTH = 427; // seconds, until the file's own duration is known

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Narration() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(LENGTH);
  const [line, setLine] = useState("");

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => setTime(a.currentTime);
    const meta = () => Number.isFinite(a.duration) && setLength(a.duration);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    a.addEventListener("timeupdate", tick);
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("play", play);
    a.addEventListener("pause", pause);
    a.addEventListener("ended", pause);
    // Captions: read the cues ourselves and show them in the bar.
    const track = a.textTracks[0];
    const cue = () => {
      const c = track?.activeCues?.[0] as VTTCue | undefined;
      setLine(c ? c.text : "");
    };
    if (track) {
      track.mode = "hidden";
      track.addEventListener("cuechange", cue);
    }
    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("loadedmetadata", meta);
      a.removeEventListener("play", play);
      a.removeEventListener("pause", pause);
      a.removeEventListener("ended", pause);
      track?.removeEventListener("cuechange", cue);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("tide:narration", { detail: { playing } }));
  }, [playing]);
  useEffect(() => () => void window.dispatchEvent(new CustomEvent("tide:narration", { detail: { playing: false } })), []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    setDocked(true);
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const close = () => {
    const a = audio.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setDocked(false);
    setLine("");
  };
  const seek = (s: number) => {
    const a = audio.current;
    if (a) a.currentTime = s;
    setTime(s);
  };

  const label = playing ? "Pause the narration" : time > 0 ? "Resume the narration" : "Listen to the arrival, read aloud";
  return (
    <>
      <button type="button" onClick={toggle} aria-pressed={playing} className="narration-listen group">
        <span aria-hidden="true" className="narration-ring" data-playing={playing || undefined}>
          <PlayIcon playing={playing} />
        </span>
        <span className="text-left">
          <span className="tracked block text-[0.6rem] text-white group-hover:text-white">{playing ? "Listening" : time > 0 ? "Resume" : "Listen"}</span>
          <span className="block font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">{time > 0 ? `${clock(time)} / ${clock(length)}` : `The arrival, read aloud · ${clock(length)}`}</span>
        </span>
        <span className="sr-only">{label}</span>
      </button>

      {/* The bar lives on <body>: the story's chapters fade (opacity) and would take it with them. */}
      {docked
        ? createPortal(
            <div className="narration-bar" role="region" aria-label="Narration">
              <button type="button" onClick={toggle} aria-pressed={playing} className="narration-ring narration-ring-s" data-playing={playing || undefined}>
                <PlayIcon playing={playing} />
                <span className="sr-only">{playing ? "Pause the narration" : "Play the narration"}</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="narration-line" aria-hidden="true">
                  {line || " "}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    className="narration-seek"
                    min={0}
                    max={Math.round(length)}
                    step={1}
                    value={Math.round(time)}
                    onChange={(e) => seek(Number(e.target.value))}
                    aria-label="Position in the narration"
                    aria-valuetext={`${clock(time)} of ${clock(length)}`}
                    style={{
                      ["--p" as string]: `${((time / length) * 100).toFixed(2)}%`,
                    }}
                  />
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[0.62rem] tabular-nums text-faint">
                    {clock(time)} / {clock(length)}
                  </span>
                </div>
              </div>
              <button type="button" onClick={close} className="narration-close" aria-label="Stop and close the narration">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" stroke="currentColor" strokeWidth="1.2">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>,
            document.body,
          )
        : null}

      <audio ref={audio} src={SRC} preload="none">
        <track kind="captions" src={CAPTIONS} srcLang="en" label="English" default />
      </audio>
    </>
  );
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
      <rect x="2" y="1" width="3" height="12" />
      <rect x="9" y="1" width="3" height="12" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
      <path d="M3 1l10 6-10 6z" />
    </svg>
  );
}
