"use client";
/** Small on/off switch for the hero's generated sound. Off by default; remembered per browser. */
import { useEffect, useRef, useState } from "react";
import { HeroSound } from "./heroSound";

const KEY = "tide.sound";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);
  const engine = useRef<HeroSound | null>(null);

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
      if (!engine.current) engine.current = new HeroSound();
      setOn(true);
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, []);

  useEffect(() => () => engine.current?.dispose(), []);

  const toggle = () => {
    const next = !on;
    if (next && !engine.current) engine.current = new HeroSound();
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
