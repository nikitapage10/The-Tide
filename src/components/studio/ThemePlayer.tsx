"use client";
/**
 * The listening corner: the Tide's theme, played on request (never on its
 * own), with a thin line that fills as it plays.
 */
import { useEffect, useRef, useState } from "react";

export function ThemePlayer({ src, title }: { src: string; title: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [p, setP] = useState(0);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => setP(a.duration ? a.currentTime / a.duration : 0);
    const end = () => setPlaying(false);
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", end);
    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("ended", end);
    };
  }, []);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      a.volume = 0.6;
      void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  };
  return (
    <div className="flex items-center gap-5">
      <button type="button" onClick={toggle} aria-pressed={playing} className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/40 text-white hover:border-white">
        <span className="sr-only">{playing ? `Pause ${title}` : `Play ${title}`}</span>
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
            <rect x="2" y="1" width="3" height="12" />
            <rect x="9" y="1" width="3" height="12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
            <path d="M3 1l10 6-10 6z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="t-title text-text">{title}</p>
        <div className="mt-3 h-px w-full bg-white/15" aria-hidden="true">
          <div className="h-px bg-white" style={{ width: `${(p * 100).toFixed(2)}%` }} />
        </div>
      </div>
      <audio ref={audio} src={src} preload="none" />
    </div>
  );
}
