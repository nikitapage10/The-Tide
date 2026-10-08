"use client";
/**
 * A long entry's table of contents: a thin rail beside the text that marks
 * the section being read. Sticky on wide screens; a scrollable row on narrow.
 */
import { useEffect, useState } from "react";

export function SectionRail({ items, label = "Contents" }: { items: { id: string; label: string }[]; label?: string }) {
  const [current, setCurrent] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setCurrent(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="section-rail">
      <ol className="flex gap-4 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
        {items.map((i) => (
          <li key={i.id} className="shrink-0">
            <a href={`#${i.id}`} aria-current={current === i.id ? "location" : undefined} className="section-rail-link tracked block py-1.5 text-[0.62rem] no-underline">
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
