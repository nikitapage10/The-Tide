/**
 * The People's rooms:
 *  peoples      → a carousel, one people per screen
 *  characters   → a mosaic of faces
 *  creatures    → a bestiary of specimen plates
 *  factions     → banners hung under each people's colour, with the constellation
 *  institutions → a ledger
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { Constellation } from "@/components/people/Constellation";
import { CanonMark } from "@/components/tide/CanonMark";
import { Plate } from "@/components/tide/Plate";
import { WorldText } from "@/components/tide/WorldText";
import type { EntityRecord } from "@/lib/contract/schema";
import { hrefFor, listRecords, type Listed } from "@/lib/domain/queries";
import { renameWorld } from "@/lib/domain/world-name";
import type { PublishedState } from "@/lib/domain/types";
import { factionsOf, imageFor, isEnclave } from "@/lib/domain/views";
import { arrival, homeland, peopleKey, peopleSigil } from "@/lib/art";
import { HoverDecode, PeoplesCarousel, Tilt } from "./client";
import { EmptyRoom } from "./GroupHero";

type Items = Listed<EntityRecord>[];
const href = (state: PublishedState, id: string) => hrefFor(state.records[id]) ?? "#";

export function Peoples({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No peoples have been recorded yet.</EmptyRoom>;
  // Written peoples first, enclaves last.
  const ordered = [...items].sort((a, b) => Number(isEnclave(a.record)) - Number(isEnclave(b.record)) || Number(!a.record.body) - Number(!b.record.body));
  return (
    <PeoplesCarousel
      peoples={ordered.map(({ record: p }, i) => ({
        id: p.id,
        href: href(state, p.id),
        title: renameWorld(p.title),
        epithet: isEnclave(p) ? "An enclave · arrived with the Drift" : (p.aliases?.[0] ?? null),
        summary: p.summary ? renameWorld(p.summary) : null,
        portrait: imageFor(state, p.id) ?? (isEnclave(p) ? arrival(p.title) : null),
        palette: p.palette ?? null,
        factions: factionsOf(state, p.id).map((f) => renameWorld(f.record.title)),
        index: i + 1,
        sigil: peopleSigil(isEnclave(p) ? "enclaves" : peopleKey(p.title)),
        homeland: homeland(peopleKey(p.title)),
      }))}
    />
  );
}

export function Characters({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No characters have been recorded yet. Named individuals will hang here, face by face.</EmptyRoom>;
  return (
    <ul className="mosaic">
      {items.map(({ record: c }, i) => (
        <li key={c.id} className={i % 5 === 0 ? "mosaic-wide" : ""}>
          <Link href={href(state, c.id)} className="mosaic-tile group block no-underline">
            <Plate src={imageFor(state, c.id)} alt={c.title} seed={c.id} ratio={i % 5 === 0 ? "4 / 3" : "3 / 4"} sizes="24rem" palette={c.palette} />
            <span className="mosaic-name">
              <HoverDecode text={renameWorld(c.title)} className="t-title text-white" />
              {c.parentId ? <span className="tracked block text-[0.54rem] text-faint">{renameWorld(titleOf(state, c.parentId))}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function titleOf(state: PublishedState, id: string) {
  const r = state.records[id]?.record;
  return r && "title" in r ? (r.title ?? "") : "";
}

export function Creatures({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No creatures have been recorded yet. Fauna and beings born of the Tide will be catalogued here.</EmptyRoom>;
  return (
    <ul className="grid gap-x-10 gap-y-16 md:grid-cols-2">
      {items.map(({ record: c }, i) => (
        <li key={c.id} className="bestiary">
          <Link href={href(state, c.id)} className="block no-underline">
            <div className="relative">
              <Plate src={imageFor(state, c.id)} alt={c.title} seed={c.id} ratio="4 / 3" unknownAs="creature" sizes="(min-width: 768px) 40rem, 90vw" />
              <span aria-hidden="true" className="bestiary-reticle" />
            </div>
            <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6">
              <span className="font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">SPECIMEN {String(i + 1).padStart(3, "0")}</span>
              <span>
                <span className="t-display-m block text-text">
                  <WorldText text={c.title} />
                </span>
                <span className="mt-2 block text-sm text-muted">
                  <WorldText text={c.summary} />
                </span>
                <CanonMark status={c.canonStatus} showLabel className="mt-3" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Factions({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No factions have been recorded yet.</EmptyRoom>;
  const peoples = listRecords(state, "entity").filter((e) => e.record.kind === "people" && !isEnclave(e.record));
  const byPeople = peoples
    .map((p) => ({ p: p.record, fs: factionsOf(state, p.record.id).map((f) => f.record).filter((f) => f.kind === "faction") }))
    .filter((x) => x.fs.length);
  const placed = new Set(byPeople.flatMap((x) => x.fs.map((f) => f.id)));
  const loose = items.filter((f) => !placed.has(f.record.id)).map((f) => f.record);
  const stars = peoples.map(({ record }) => ({ record, factions: factionsOf(state, record.id).map((f) => f.record), href: href(state, record.id), factionHref: (id: string) => href(state, id) }));
  return (
    <>
      <div className="mb-20">
        <Constellation stars={stars} links={listRecords(state, "relationship").map((r) => r.record)} />
      </div>
      <div className="grid gap-x-10 gap-y-16 md:grid-cols-2 xl:grid-cols-3">
        {byPeople.map(({ p, fs }) => (
          <section key={p.id} aria-label={p.title} style={{ "--banner": p.palette ?? "#dfe5ec" } as CSSProperties}>
            <Link href={href(state, p.id)} className="tracked mb-5 flex items-center gap-3 text-[0.62rem] text-faint no-underline hover:text-white">
              <span aria-hidden="true" className="banner-swatch" />
              {p.title}
            </Link>
            <ul className="space-y-3">
              {fs.map((f) => (
                <li key={f.id}>
                  <Link href={href(state, f.id)} className="banner group block no-underline">
                    <span className="t-title block text-text group-hover:text-white">
                      <WorldText text={f.title} />
                    </span>
                    {f.aliases?.[0] ? <span className="tracked block text-[0.54rem] text-faint">{f.aliases[0]}</span> : null}
                    <span className="mt-2 block text-sm text-muted">
                      <WorldText text={f.summary} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {loose.length ? (
          <section aria-label="Unaffiliated">
            <p className="tracked mb-5 text-[0.62rem] text-faint">Unaffiliated</p>
            <ul className="space-y-3">
              {loose.map((f) => (
                <li key={f.id}>
                  <Link href={href(state, f.id)} className="banner group block no-underline">
                    <span className="t-title block text-text">
                      <WorldText text={f.title} />
                    </span>
                    <span className="mt-2 block text-sm text-muted">
                      <WorldText text={f.summary} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

export function Institutions({ state, items }: { state: PublishedState; items: Items }) {
  if (!items.length) return <EmptyRoom>No institutions have been recorded yet.</EmptyRoom>;
  return (
    <ol className="ledger">
      {items.map(({ record: r }, i) => (
        <li key={r.id}>
          <Tilt>
            <Link href={href(state, r.id)} className="ledger-row group no-underline">
              <span className="font-[family-name:var(--font-mono)] text-[0.66rem] text-faint">№ {String(i + 1).padStart(3, "0")}</span>
              <span className="min-w-0">
                <span className="t-display-m block text-text group-hover:text-white">
                  <WorldText text={r.title} />
                </span>
                <span className="mt-1 block text-sm text-muted">
                  <WorldText text={r.summary} />
                </span>
              </span>
              <span className="tracked text-right text-[0.56rem] text-faint">{r.parentId ? renameWorld(titleOf(state, r.parentId)) : "—"}</span>
            </Link>
          </Tilt>
        </li>
      ))}
    </ol>
  );
}
