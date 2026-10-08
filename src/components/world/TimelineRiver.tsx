/**
 * The timeline river: the world's events in order along one line, gathered by
 * era (rough proportions, not a scale: the sources give approximate spans).
 * Each mark's stroke says how certain its placing is. Scrolls sideways
 * inside itself; never the page.
 */
import Link from "next/link";
import { CanonMark } from "@/components/tide/CanonMark";
import { ERA_INFO } from "@/components/tide/EraBand";
import { Redacted } from "@/components/tide/Redacted";
import type { TimelineEntry } from "@/lib/domain/views";

const CERTAIN: Record<string, string> = { confirmed: "solid", approximate: "dashed", uncertain: "dotted", unknown: "dotted" };

export function TimelineRiver({ entries, hrefOf }: { entries: TimelineEntry[]; hrefOf: (id: string) => string }) {
  const eras = ERA_INFO.map((e) => ({ ...e, items: entries.filter((x) => (x.era ?? "verdancy") === e.era) })).filter((e) => e.items.length);
  if (!eras.length) return <p className="text-sm text-faint">No events have been placed in time yet.</p>;
  return (
    <div className="timeline-river -mx-1 overflow-x-auto pb-4" tabIndex={0} aria-label="Timeline, scrolls sideways">
      <ol className="flex min-w-max gap-0 px-1">
        {eras.map((era) => (
          <li key={era.era} className="timeline-era relative pr-10" style={{ minWidth: `${Math.max(16, era.items.length * 13)}rem` }}>
            <p className="tracked mb-3 text-[0.62rem] text-white">{era.label}</p>
            <p className="mb-6 font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">{era.span}</p>
            <span aria-hidden="true" className="timeline-line absolute left-0 right-0 top-[4.3rem] h-px" />
            <ol className="flex gap-6">
              {era.items.map((e) => (
                <li key={e.id} className="relative w-48 shrink-0 pt-6">
                  <span aria-hidden="true" className="timeline-tick absolute left-0 top-[-0.2rem] h-5 w-px" data-certainty={CERTAIN[e.certainty] ?? "dotted"} />
                  <Link href={hrefOf(e.id)} className="group block no-underline">
                    <span className="block font-[family-name:var(--font-mono)] text-[0.6rem] tracking-[0.12em] text-faint">{e.label}</span>
                    <span className="t-title mt-1 block text-[1.08rem] text-text group-hover:text-white">
                      <Redacted text={e.title} />
                    </span>
                    {e.people ? <span className="tracked mt-1 block text-[0.56rem] text-faint">{e.people}</span> : null}
                    {e.summary ? (
                      <span className="mt-2 line-clamp-3 block text-[0.82rem] leading-snug text-muted">
                        <Redacted text={e.summary} />
                      </span>
                    ) : null}
                    <CanonMark status={e.canon} className="mt-2" />
                  </Link>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
