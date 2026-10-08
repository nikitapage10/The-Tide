"use client";
/**
 * Things arrive, they don't appear: content fades up out of the dark as it
 * enters the view (once). With `decode`, a heading's text arrives in the
 * Tide's script and resolves into English. Visible at once with reduced
 * motion, without JavaScript, and to search engines (the text is always in
 * the HTML).
 */
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Decode } from "@/components/glyphs/Decode";

export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delay = 0,
  decode,
}: {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  delay?: number;
  /** Decode this text instead of rendering children. */
  decode?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} data-shown={shown ? "" : undefined} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {decode !== undefined ? <Decode text={decode} active={shown} delay={delay} /> : children}
    </Tag>
  );
}
