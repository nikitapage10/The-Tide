/**
 * The Library's rooms:
 *  campaigns     → voyages: each a route through its sessions
 *  one-shots     → a fanned deck of cards
 *  novels        → glass volumes that turn toward you
 *  short fiction → first lines, set large
 */
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CanonMark } from "@/components/tide/CanonMark";
import { WorldText } from "@/components/tide/WorldText";
import type { StoryRecord } from "@/lib/contract/schema";
import { partsForStory, sessionsForStory, type Listed } from "@/lib/domain/queries";
import { renameWorld } from "@/lib/domain/world-name";
import { volume } from "@/lib/art";
import type { PublishedState } from "@/lib/domain/types";
import { Tilt } from "./client";
import { EmptyRoom } from "./GroupHero";

type Items = Listed<StoryRecord>[];

export function Campaigns({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No campaigns yet. Each will appear as a voyage, its sessions the ports along the way.</EmptyRoom>;
  return (
    <ul className="space-y-20">
      {items.map(({ record: s }) => {
        const sessions = sessionsForStory(state, s.id);
        return (
          <li key={s.id} className="voyage">
            <Link href={`/stories/${s.id}`} className="group block no-underline">
              <span className="t-display-l block text-text group-hover:text-white">
                <WorldText text={s.title} />
              </span>
              <span className="t-lede mt-3 block max-w-2xl">
                <WorldText text={s.summary} />
              </span>
            </Link>
            <div className="-mx-1 mt-10 overflow-x-auto px-1 pb-2">
              <svg aria-hidden="true" className="voyage-route" viewBox="0 0 1000 120" preserveAspectRatio="none">
                <path d="M0 80 C 120 20, 240 110, 360 60 S 600 20, 720 70 S 900 110, 1000 40" />
              </svg>
              <ol className="relative -mt-16 flex min-w-max gap-14">
                {sessions.length ? (
                  sessions.map(({ record: x }, i) => (
                    <li key={x.id} className="w-40" style={{ "--k": i, marginTop: `${(i % 3) * 1.2}rem` } as CSSProperties}>
                      <span aria-hidden="true" className="voyage-port" />
                      <Link href={`/stories/sessions/${x.id}`} className="mt-3 block no-underline">
                        <span className="block font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">PORT {String(x.sequence ?? i + 1).padStart(2, "0")}</span>
                        <span className="t-title block text-text">
                          <WorldText text={x.title} />
                        </span>
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-faint">No sessions yet.</li>
                )}
              </ol>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OneShots({ items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No one-shots yet. They&rsquo;ll be dealt here like cards.</EmptyRoom>;
  return (
    <ul className="deck" style={{ "--n": items.length } as CSSProperties}>
      {items.map(({ record: s }, i) => (
        <li key={s.id} className="deck-card" style={{ "--i": i } as CSSProperties}>
          <Link href={`/stories/${s.id}`} className="deck-face group block h-full no-underline">
            <span className="font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">ONE-SHOT · {String(i + 1).padStart(2, "0")}</span>
            <span className="t-display-m mt-auto block text-text">
              <WorldText text={s.title} />
            </span>
            <span className="mt-3 block text-sm text-muted">
              <WorldText text={s.summary} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Novels({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No novels yet.</EmptyRoom>;
  return (
    <ul className="grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ record: s }) => {
        const parts = partsForStory(state, s.id);
        return (
          <li key={s.id}>
            <Tilt className="cover-wrap">
              <Link href={`/stories/${s.id}`} className="cover cover-glass block no-underline">
                <Image src={volume("novel")} alt="" fill sizes="(min-width: 1024px) 22vw, 45vw" className="cover-volume" />
                <span className="cover-title t-display-m">{renameWorld(s.title)}</span>
                <span aria-hidden="true" className="cover-rule" />
                <span className="tracked cover-meta text-[0.54rem]">{parts.length ? `${parts.length} parts` : "unwritten"}</span>
              </Link>
            </Tilt>
            <p className="mt-5 text-sm text-muted">
              <WorldText text={s.summary} />
            </p>
            <CanonMark status={s.canonStatus} className="mt-2" />
          </li>
        );
      })}
    </ul>
  );
}

/** The first real line of prose in a body (skipping quotes and headings). */
function firstLine(body: string | null | undefined): string | null {
  if (!body) return null;
  const para = body.split(/\n\s*\n/).find((p) => p.trim() && !/^\s*(>|#)/.test(p));
  if (!para) return null;
  const sentence = para.replace(/\s+/g, " ").trim().match(/^.{20,220}?[.!?…](\s|$)/);
  return (sentence?.[0] ?? para.slice(0, 200)).trim();
}

export function ShortFiction({ items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No short fiction yet.</EmptyRoom>;
  return (
    <ol className="first-lines">
      {items.map(({ record: s }) => {
        const line = firstLine(s.body) ?? s.summary;
        return (
          <li key={s.id}>
            <Link href={`/stories/${s.id}`} className="group block border-t border-white/10 py-12 no-underline">
              {line ? (
                <span className="first-line block">
                  &ldquo;<WorldText text={line} />&rdquo;
                </span>
              ) : null}
              <span className="tracked mt-6 flex items-center gap-4 text-[0.6rem] text-faint group-hover:text-white">
                <span aria-hidden="true" className="h-px w-10 bg-white/30" />
                <WorldText text={s.title} />
                {s.demo ? <span>· demo</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
