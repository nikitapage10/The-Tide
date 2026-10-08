/**
 * The Studio's rooms:
 *  music      → a tracklist with a moving level meter, and the theme to play
 *  artwork    → a masonry gallery
 *  elements   → specimen cards
 *  aesthetics → a pinned-up mood collage
 *  branding   → a brand sheet (the mark, the script, the work)
 *  other      → a stack of documents
 */
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { TideGlyph } from "@/components/glyphs/TideScript";
import { ThemePlayer } from "@/components/studio/ThemePlayer";
import { Plate } from "@/components/tide/Plate";
import { Redacted } from "@/components/tide/Redacted";
import type { MediaRecord } from "@/lib/contract/schema";
import type { Listed } from "@/lib/domain/queries";
import type { PublishedState } from "@/lib/domain/types";
import { isImageUrl } from "@/lib/domain/views";
import { EmptyRoom } from "./GroupHero";

type Items = Listed<MediaRecord>[];
const img = (m: MediaRecord) => (m.url && isImageUrl(m.url) ? m.url : null);
const STAGE: Record<MediaRecord["stage"], string> = { inspiration: "Inspiration", draft: "Draft", approved: "Approved", final: "Final" };

export function Music({ items }: { state: PublishedState; items: Items }) {
  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="music-deck">
        <p className="tracked mb-6 text-[0.6rem] text-faint">Now playing</p>
        <ThemePlayer src="/audio/tide-theme.mp3" title="The Tide, theme" />
        <span aria-hidden="true" className="meter mt-10">
          {Array.from({ length: 32 }, (_, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
      </div>
      <ol className="tracklist">
        <li className="tracklist-row">
          <span className="font-[family-name:var(--font-mono)] text-[0.66rem] text-faint">01</span>
          <span className="t-title text-text">The Tide, theme</span>
          <span className="font-[family-name:var(--font-mono)] text-[0.66rem] text-faint">4:47</span>
        </li>
        {items.map(({ record: m }, i) => (
          <li key={m.id}>
            <Link href={`/studio/item/${m.id}`} className="tracklist-row group no-underline">
              <span className="font-[family-name:var(--font-mono)] text-[0.66rem] text-faint">{String(i + 2).padStart(2, "0")}</span>
              <span className="t-title text-text group-hover:text-white">
                <Redacted text={m.title} />
              </span>
              <span className="tracked text-[0.54rem] text-faint">{m.demo ? "demo" : STAGE[m.stage]}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Artwork({ items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No artwork yet.</EmptyRoom>;
  return (
    <ul className="masonry">
      {items.map(({ record: m }) => (
        <li key={m.id} className="masonry-item">
          <Plate
            src={img(m)}
            alt={m.title}
            seed={m.id}
            ratio={m.role === "portrait" ? "3 / 4" : m.role === "hero" ? "16 / 9" : "4 / 3"}
            href={`/studio/item/${m.id}`}
            sizes="(min-width: 1024px) 30vw, 90vw"
            caption={
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-text">
                  <Redacted text={m.title} />
                </span>
                <span className="tracked text-[0.54rem] text-faint">{STAGE[m.stage]}</span>
              </span>
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function Elements({ items }: { state: PublishedState; items: Items }) {
  if (!items.length)
    return (
      <div>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {"TIDEFLOW".split("").slice(0, 6).map((ch) => (
            <li key={ch} className="specimen-glyph grid aspect-square place-items-center border border-white/10">
              <span className="text-[3rem] text-white/80" style={{ "--glyph-w": "1.6em", "--glyph-h": "1.4em" } as CSSProperties}>
                <TideGlyph ch={ch} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-faint">No artistic elements published yet. Motifs, textures and symbols will be catalogued here; for now, a few of the script&rsquo;s glyphs.</p>
      </div>
    );
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ record: m }, i) => (
        <li key={m.id} className="specimen-card">
          <Link href={`/studio/item/${m.id}`} className="block no-underline">
            <Plate src={img(m)} alt={m.title} seed={m.id} ratio="1 / 1" sizes="18rem" />
            <span className="mt-3 flex items-baseline justify-between font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">
              <span>EL-{String(i + 1).padStart(3, "0")}</span>
              <span>{STAGE[m.stage]}</span>
            </span>
            <span className="mt-1 block text-sm text-text">
              <Redacted text={m.title} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Aesthetics({ items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No aesthetics boards yet.</EmptyRoom>;
  return (
    <ul className="collage">
      {items.map(({ record: m }, i) => (
        <li key={m.id} className="collage-item" style={{ "--r": `${((i * 47) % 9) - 4}deg`, "--y": `${(i * 29) % 40}px` } as CSSProperties}>
          <span aria-hidden="true" className="collage-pin" />
          <Plate
            src={img(m)}
            alt={m.title}
            seed={m.id}
            ratio={i % 2 ? "3 / 4" : "4 / 3"}
            href={`/studio/item/${m.id}`}
            sizes="20rem"
            caption={
              <span className="text-xs text-muted">
                <Redacted text={m.title} />
              </span>
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function Branding({ items }: { state: PublishedState; items: Items }) {
  return (
    <div className="brand-sheet grid gap-px overflow-hidden bg-white/[0.07] lg:grid-cols-3">
      <div className="grid place-items-center bg-bg p-10 lg:row-span-2">
        <Image src="/brand/tide-mark.png" alt="The Tide's mark" width={140} height={232} className="h-56 w-auto" />
        <p className="tracked mt-8 text-[0.6rem] text-faint">The mark</p>
      </div>
      <div className="bg-bg p-8">
        <p className="tracked mb-4 text-[0.6rem] text-faint">The name</p>
        <p className="font-[family-name:var(--font-display)] text-4xl uppercase tracking-[0.4em] text-white">The Tide</p>
      </div>
      <div className="bg-bg p-8">
        <p className="tracked mb-4 text-[0.6rem] text-faint">The script</p>
        <p className="flex gap-3 text-3xl text-white" style={{ "--glyph-w": "1.3em", "--glyph-h": "1.2em" } as CSSProperties}>
          {"TIDE".split("").map((c) => (
            <TideGlyph key={c} ch={c} />
          ))}
        </p>
      </div>
      <div className="bg-bg p-8 lg:col-span-2">
        <p className="tracked mb-4 text-[0.6rem] text-faint">Work</p>
        {items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map(({ record: m }) => (
              <li key={m.id}>
                <Link href={`/studio/item/${m.id}`} className="block border-t border-white/[0.08] py-3 text-text no-underline hover:text-white">
                  <Redacted text={m.title} />
                  <span className="tracked ml-2 text-[0.54rem] text-faint">{STAGE[m.stage]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">No branding work published yet.</p>
        )}
      </div>
    </div>
  );
}

export function Other({ items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>Nothing else filed yet.</EmptyRoom>;
  return (
    <ul className="doc-stack mx-auto max-w-2xl">
      {items.map(({ record: m }, i) => (
        <li key={m.id} className="doc-sheet" style={{ "--i": i } as CSSProperties}>
          <Link href={`/studio/item/${m.id}`} className="block no-underline">
            <span className="font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">FILE {String(i + 1).padStart(3, "0")}</span>
            <span className="t-title mt-2 block text-text">
              <Redacted text={m.title} />
            </span>
            <span className="mt-1 block text-sm text-muted">
              <Redacted text={m.summary} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
