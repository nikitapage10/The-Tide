"use client";
/** Small on/off switch for the hero's generated sound. Off by default; remembered per browser. */
import { useEffect, useRef, useState } from "react";
import { HeroSound } from "./heroSound";

const KEY = "tide.sound";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);
  const engine = useRef<HeroSound | null>(null);
  const narrating = useRef(false);

  // Restore the preference; audio itself still waits for a click (browser rule).
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(KEY) === "on";
    } catch {
      /* storage unavailable */
    }
    if (!saved) return;
    const start = () => {
      if (!engine.current) {
        engine.current = new HeroSound();
        if (narrating.current) engine.current.duck(true);
      }
      setOn(true);
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, []);

  useEffect(() => () => engine.current?.dispose(), []);

  // Silent while a narration speaks (and if sound is turned on mid-narration).
  useEffect(() => {
    const onNarration = (e: Event) => {
      narrating.current = (e as CustomEvent<{ playing: boolean }>).detail.playing;
      engine.current?.duck(narrating.current);
    };
    window.addEventListener("tide:narration", onNarration);
    return () => window.removeEventListener("tide:narration", onNarration);
  }, []);

  const toggle = () => {
    const next = !on;
    if (next && !engine.current) {
      engine.current = new HeroSound();
      if (narrating.current) engine.current.duck(true);
    }
    if (!next) {
      engine.current?.dispose();
      engine.current = null;
    }
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={on} className={className}>
      <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`sound-bar block w-px bg-current ${on ? "sound-bar-on" : ""}`} style={{ animationDelay: `${i * 0.13}s` }} />
        ))}
      </span>
      Sound {on ? "on" : "off"}
    </button>
  );
}
