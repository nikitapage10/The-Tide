"use client";
/**
 * A page refresh always starts at the top (the home hero's intro plays from the
 * beginning). In-app back/forward navigation keeps its normal scroll behaviour.
 */
import { useEffect } from "react";

export function ScrollReset() {
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload" && !window.location.hash) window.scrollTo(0, 0);
    // Stop the browser restoring the old position on the next reload.
    const onUnload = () => {
      history.scrollRestoration = "manual";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
  return null;
}
