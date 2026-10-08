/**
 * The World's rooms, each built for what it holds:
 *  environments → strata (painted bands of weather you can open)
 *  places       → a survey (a radar over the relief, with callouts)
 *  history      → the six ages, then a spine over the river of time, drawn
 *                 as you scroll, with a running year
 *  technology   → blueprints, each with its glass object
 *  relics       → crystal vitrines under moving light
 *  phenomena    → their luminous images (live particle fields otherwise)
 *  workings     → a circuit of rules feeding each other
 *  concepts     → a glossary
 */
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { FxKind } from "@/components/home/CalloutFx";
import { Reveal } from "@/components/motion/Reveal";
import { Callout } from "@/components/tide/Callout";
import { CanonMark } from "@/components/tide/CanonMark";
import { eraLabel } from "@/components/tide/EraBand";
import { Plate } from "@/components/tide/Plate";
import { WorldText } from "@/components/tide/WorldText";
import { ArtSigil } from "@/components/tide/ArtSigil";
import { AGES, ART, agePanel, ageSigil, environmentBand, object, phenomenon, type AgeArt } from "@/lib/art";
import type { EntityRecord } from "@/lib/contract/schema";
import { hrefFor, type Listed } from "@/lib/domain/queries";
import { renameWorld } from "@/lib/domain/world-name";
import type { PublishedState } from "@/lib/domain/types";
import { imageFor } from "@/lib/domain/views";
import { HistoryScroll, HoverDecode, LiveFx, type HistoryItem } from "./client";
import { EmptyRoom } from "./GroupHero";

type Items = Listed<EntityRecord>[];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const href = (state: PublishedState, id: string) => hrefFor(state.records[id]) ?? "#";
const parentTitle = (state: PublishedState, r: EntityRecord) => {
  const p = r.parentId ? state.records[r.parentId]?.record : null;
  return p && "title" in p ? (p.title ?? null) : null;
};

export function Environments({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length)
    return (
      <div className="strata" aria-hidden="false">
        {(
          [
            ["Seas", "sea"],
            ["Deserts", "desert"],
            ["Forests", "forest"],
            ["The deep", "abyss"],
          ] as const
        ).map(([n, band], i) => (
          <div key={n} className="stratum stratum-empty" style={{ "--i": i } as CSSProperties}>
            <Image src={environmentBand(band, band)} alt="" fill sizes="100vw" className="stratum-band" />
            <span className="tracked relative text-[0.6rem] text-faint">{n} · uncharted</span>
          </div>
        ))}
        <p className="mt-6 text-sm text-faint">No environments have been recorded yet. Biomes, seas and regions appear here as bands you can open.</p>
      </div>
    );
  return (
    <ol className="strata">
      {items.map(({ record: r }, i) => (
        <li key={r.id} className="stratum" style={{ "--i": i } as CSSProperties}>
          <Image src={imageFor(state, r.id, "hero") ?? environmentBand(r.title, r.id)} alt="" fill sizes="100vw" className="stratum-band" />
          <Link href={href(state, r.id)} className="stratum-link no-underline">
            <span className="font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <span className="t-display-m text-text">
              <WorldText text={r.title} />
            </span>
            <span className="stratum-summary text-sm text-muted">
              <WorldText text={r.summary} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function Places({ state, items: all }: { state: PublishedState; items: Items }) {
  // The world itself is the globe, not a place on it.
  const items = all.filter((p) => !(p.record.tags ?? []).includes("the world"));
  if (!items.length) return <EmptyRoom>No places have been recorded yet.</EmptyRoom>;
  return (
    <>
      <div className="survey relative hidden overflow-hidden md:block" aria-label="Survey of places">
        <Image src={ART.survey} alt="" fill sizes="100vw" className="survey-ground" />
        <span aria-hidden="true" className="survey-sweep" />
        <span aria-hidden="true" className="survey-rings" />
        {items.map(({ record: r }, i) => {
          const h = hash(r.id);
          // One cell each on a loose grid, jittered within it; labels face the open side.
          const cols = 3;
          const rows = Math.ceil(items.length / cols);
          const cx = i % cols;
          const cy = Math.floor(i / cols);
          const x = 8 + cx * 30 + ((h % 1000) / 1000) * 12;
          const y = 10 + ((cy + 0.15 + (((h >> 10) % 1000) / 1000) * 0.5) / rows) * 80;
          return <Callout key={r.id} title={r.title} sub={parentTitle(state, r)} href={href(state, r.id)} x={x} y={y} side={cx === cols - 1 ? "left" : "right"} canon={r.canonStatus} delay={i * 140} />;
        })}
      </div>
      <ul className="mt-12 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ record: r }) => (
          <li key={r.id}>
            <Link href={href(state, r.id)} className="group block border-t border-white/[0.08] py-4 no-underline">
              <span className="tracked block text-[0.56rem] text-faint">{parentTitle(state, r) ?? "The world"}</span>
              <span className="t-title mt-1 block text-text group-hover:text-white">
                <WorldText text={r.title} />
              </span>
              <span className="mt-1 line-clamp-2 block text-sm text-muted">
                <WorldText text={r.summary} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function History({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No history has been recorded yet.</EmptyRoom>;
  const dated = items.filter((i) => typeof i.record.chronology?.sortKey === "number").sort((a, b) => a.record.chronology!.sortKey! - b.record.chronology!.sortKey!);
  const undated = items.filter((i) => typeof i.record.chronology?.sortKey !== "number");
  const toItem = ({ record: r }: Listed<EntityRecord>): HistoryItem => ({
    id: r.id,
    href: href(state, r.id),
    title: renameWorld(r.title),
    summary: r.summary ? renameWorld(r.summary) : null,
    label: r.chronology?.label ?? null,
    era: r.era ?? null,
    eraLabel: eraLabel(r.era),
    year: Math.round(r.chronology?.sortKey ?? 0),
    certainty: r.chronology?.certainty ?? "unknown",
    people: parentTitle(state, r),
  });
  return (
    <>
      <AgesStrip />
      <div className="history-river-wrap relative">
        <Image src={ART.river} alt="" width={600} height={1800} aria-hidden="true" className="history-river" />
        <HistoryScroll items={dated.map(toItem)} />
      </div>
      {undated.length ? (
        <section aria-labelledby="undated-h" className="mt-20 border-t border-white/10 pt-8">
          <h2 id="undated-h" className="tracked mb-6 text-[0.62rem] text-faint">
            Not yet placed in time
          </h2>
          <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map(({ record: r }) => (
              <li key={r.id}>
                <Link href={href(state, r.id)} className="block border-t border-white/[0.08] py-4 text-text no-underline hover:text-white">
                  <WorldText text={r.title} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const AGE_NAMES: Record<AgeArt, string> = { shoreborn: "The Shoreborn", undertow: "The Undertow", veil: "The Veil", verdancy: "Verdancy", tide: "The Tide", today: "Today" };

/** The six ages as tall panels, each a crop of the planet in its time, under its sigil. */
function AgesStrip() {
  return (
    <ol className="ages-strip mb-20" aria-label="The ages">
      {AGES.map((a, i) => (
        <li key={a} className="ages-panel" style={{ "--i": i } as CSSProperties}>
          <Image src={agePanel(a)} alt="" fill sizes="(min-width: 1024px) 15vw, 30vw" className="object-cover" />
          <span className="ages-label">
            <ArtSigil src={ageSigil(a)} size={44} className="mb-3" />
            <span className="font-[family-name:var(--font-mono)] block text-[0.6rem] text-white/60">{["I", "II", "III", "IV", "V", "VI"][i]}</span>
            <span className="tracked block text-[0.6rem] text-white">{AGE_NAMES[a]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Technology({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No technology has been recorded yet.</EmptyRoom>;
  return (
    <ul className="blueprint grid gap-6 p-4 sm:p-8 md:grid-cols-2">
      {items.map(({ record: r }, i) => (
        <li key={r.id}>
          <Link href={href(state, r.id)} className="blueprint-card group block no-underline">
            <span aria-hidden="true" className="blueprint-corners" />
            <Image src={imageFor(state, r.id) ?? object(r.title, r.id, "technology")} alt="" width={320} height={320} className="blueprint-object" />
            <span className="flex items-baseline justify-between font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">
              <span>FIG. {String(i + 1).padStart(2, "0")}</span>
              <span>{r.canonStatus.toUpperCase()}</span>
            </span>
            <span className="t-display-m mt-6 block text-text group-hover:text-white">
              <WorldText text={r.title} />
            </span>
            <span className="mt-3 block text-sm leading-relaxed text-muted">
              <WorldText text={r.summary} />
            </span>
            <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-1 border-t border-dashed border-white/15 pt-4 font-[family-name:var(--font-mono)] text-[0.64rem]">
              <dt className="text-faint">MAKERS</dt>
              <dd className="text-text">{parentTitle(state, r) ?? "unknown"}</dd>
              <dt className="text-faint">ERA</dt>
              <dd className="text-text">{eraLabel(r.era) ?? "unplaced"}</dd>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Relics({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No relics have been recorded yet.</EmptyRoom>;
  return (
    <ul className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ record: r }, i) => (
        <li key={r.id} className="vitrine" style={{ "--i": i } as CSSProperties}>
          <Link href={href(state, r.id)} className="block no-underline">
            <span aria-hidden="true" className="vitrine-light" />
            {imageFor(state, r.id, "hero") ?? imageFor(state, r.id) ? (
              <>
                <div className="vitrine-case">
                  <Plate src={imageFor(state, r.id, "hero") ?? imageFor(state, r.id)} alt={r.title} seed={r.id} ratio="1 / 1" sizes="22rem" />
                </div>
                <span aria-hidden="true" className="vitrine-plinth" />
              </>
            ) : (
              // No photograph yet: the relic's glass likeness, in the crystal case.
              <div className="vitrine-glass">
                <Image src={ART.vitrine} alt="" fill sizes="22rem" className="object-contain" />
                <Image src={object(r.title, r.id, "relic")} alt="" width={240} height={240} className="vitrine-object" />
              </div>
            )}
            <span className="vitrine-plaque">
              <span className="t-title block text-text">
                <WorldText text={r.title} />
              </span>
              <span className="mt-1 block text-xs text-muted">
                <WorldText text={r.summary} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Which of the hero's effects a phenomenon is drawn with. */
function fxFor(title: string): FxKind {
  const t = title.toLowerCase();
  if (t.includes("drowning")) return "sink";
  if (t.includes("divergence")) return "split";
  if (t.includes("drift")) return "drift";
  if (t.includes("window")) return "echo";
  if (t.includes("miasma")) return "veil";
  if (t.includes("tide")) return "tideline";
  if (t.includes("storm")) return "lightning";
  const pool: FxKind[] = ["glint", "wave", "orbit", "stream", "isobars", "arc"];
  return pool[hash(t) % pool.length]!;
}

export function Phenomena({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No phenomena have been recorded yet.</EmptyRoom>;
  return (
    <ul className="grid gap-px overflow-hidden bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ record: r }) => (
        <li key={r.id} className="bg-bg">
          <Link href={href(state, r.id)} className="phenomenon group relative block overflow-hidden no-underline">
            {phenomenon(r.title) ? (
              <Image src={phenomenon(r.title)!} alt="" fill sizes="(min-width: 1024px) 33vw, 90vw" className="phenomenon-art" />
            ) : (
              <LiveFx kind={fxFor(r.title)} scale={3} className="absolute left-1/2 top-[30%]" />
            )}
            <span className="relative z-[1] flex h-full flex-col justify-end p-6">
              <span className="tracked text-[0.56rem] text-faint">{eraLabel(r.era) ?? "phenomenon"}</span>
              <span className="t-display-m mt-2 block text-text group-hover:text-white">
                <WorldText text={r.title} />
              </span>
              <span className="mt-2 line-clamp-2 block text-sm text-muted">
                <WorldText text={r.summary} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Workings({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No rules of the world have been recorded yet.</EmptyRoom>;
  return (
    <ol className="circuit relative mx-auto max-w-3xl">
      {items.map(({ record: r }, i) => (
        <li key={r.id} className="circuit-node relative" style={{ "--i": i } as CSSProperties}>
          {i < items.length - 1 ? <span aria-hidden="true" className="circuit-wire" /> : null}
          <Link href={href(state, r.id)} className="circuit-card group block no-underline">
            <span aria-hidden="true" className="circuit-pulse" />
            <span className="font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">RULE {String(i + 1).padStart(2, "0")}</span>
            <span className="t-display-m mt-2 block text-text group-hover:text-white">
              <WorldText text={r.title} />
            </span>
            {r.aliases?.length ? <span className="tracked mt-1 block text-[0.56rem] text-faint">{r.aliases.join(" · ")}</span> : null}
            <span className="mt-3 block text-sm leading-relaxed text-muted">
              <WorldText text={r.summary} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function Concepts({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No terms have been recorded yet.</EmptyRoom>;
  const groups = new Map<string, Items>();
  for (const it of items) {
    const letter = renameWorld(it.record.title).replace(/^(the|a|an)\s+/i, "").normalize("NFKD").charAt(0).toUpperCase();
    const k = /[A-Z]/.test(letter) ? letter : "#";
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return (
    <div className="glossary grid gap-x-12 gap-y-14 md:grid-cols-2">
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letter, list]) => (
          <section key={letter} aria-label={letter} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-6">
            <Reveal as="p" className="glossary-letter" decode={letter} />
            <dl className="space-y-6">
              {list.map(({ record: r }) => (
                <div key={r.id}>
                  <dt>
                    <Link href={href(state, r.id)} className="t-title text-text no-underline hover:text-white">
                      <HoverDecode text={renameWorld(r.title)} />
                    </Link>
                    {r.aliases?.length ? <span className="ml-3 font-[family-name:var(--font-display)] italic text-faint">{r.aliases.join(", ")}</span> : null}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">
                    <WorldText text={r.summary} />
                    <CanonMark status={r.canonStatus} className="ml-2" />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
    </div>
  );
}
