"use client";
/**
 * The universal annotation, as on the home hero: a ringed point, a hairline
 * leader, and a label that decodes from the Tide's script when it comes into
 * view. Placed absolutely (x, y as percentages of its container) on maps,
 * portraits and timelines, or inline when x/y are omitted.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Decode, decodeMs } from "@/components/glyphs/Decode";
import { redactPlain } from "@/lib/domain/redaction";

export function Callout({
  title,
  sub,
  href,
  x,
  y,
  side = "right",
  canon,
  delay = 0,
}: {
  title: string;
  sub?: string | null;
  href?: string;
  x?: number;
  y?: number;
  side?: "left" | "right";
  canon?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setOn(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const placed = x !== undefined && y !== undefined;
  const t = redactPlain(title);
  const label = (
    <>
      <span className="tracked block text-white">
        <Decode text={t} active={on} delay={delay} />
      </span>
      {sub ? (
        <span className="tracked block text-[0.66rem] leading-5 text-muted">
          <Decode text={redactPlain(sub)} active={on} delay={delay + decodeMs(t) * 0.5} />
        </span>
      ) : null}
    </>
  );
  return (
    <div
      ref={ref}
      className={`tide-callout obs ${on ? "obs-on" : ""} ${placed ? "absolute" : "relative inline-block"}`}
      data-canon={canon}
      style={placed ? { left: `${x}%`, top: `${y}%` } : undefined}
    >
      <span aria-hidden="true" className="obs-ping absolute -left-2 -top-2 h-4 w-4 rounded-full border border-white/80">
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      </span>
      <span aria-hidden="true" className={`obs-line tide-callout-line absolute top-0 h-px bg-white/50 ${side === "right" ? "left-2 origin-left" : "right-2 origin-right"}`} />
      <div className={`absolute -top-2.5 w-max max-w-[15rem] ${side === "right" ? "left-[4.5rem]" : "right-[4.5rem] text-right"}`}>
        {href ? (
          <Link href={href} className="block no-underline hover:[&_.tracked]:text-white">
            {label}
          </Link>
        ) : (
          label
        )}
      </div>
    </div>
  );
}
