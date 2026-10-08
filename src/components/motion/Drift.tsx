"use client";
/** A slow parallax: the content drifts against the scroll by a few percent of its own height. */
import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "./useScrollProgress";

export function Drift({ children, amount = 6, className = "" }: { children: ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollProgress(ref, { mode: "cross", name: "--drift" });
  return (
    <div ref={ref} className={`drift ${className}`} style={{ ["--drift-amount" as string]: `${amount}%` }}>
      {children}
    </div>
  );
}
