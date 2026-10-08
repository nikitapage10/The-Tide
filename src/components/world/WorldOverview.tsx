/**
 * The World, as an atlas: the globe and what is charted on it, the long
 * history as a river of events, the Three Consequences, and an index of
 * everything else (environments, technology, relics, how the world works).
 */
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { ConsequenceSigil } from "@/components/tide/ConsequenceSigil";
import { EraBand } from "@/components/tide/EraBand";
import { WorldText } from "@/components/tide/WorldText";
import { SectionIntro } from "@/components/tide/SectionIntro";
import { WORLD_NAME, WORLD_NAME_MEANING, WORLD_NAME_PRONUNCIATION } from "@/lib/domain/world-name";
import { hrefFor, listRecords } from "@/lib/domain/queries";
import { WORLD_KIND_GROUPS } from "@/lib/domain/sections";
import type { PublishedState } from "@/lib/domain/types";
import { consequences, places, timeline } from "@/lib/domain/views";
import { Globe, type GlobePoint } from "./Globe";
import { TimelineRiver } from "./TimelineRiver";
import { ART } from "@/lib/art";

export function WorldOverview({ state }: { state: PublishedState }) {
  const href = (id: string) => hrefFor(state.records[id]) ?? "/world";
  const { charted, uncharted } = places(state);
  const points: GlobePoint[] = charted.flatMap(({ record: r }) => (r.location && "lat" in r.location ? [{ id: r.id, lat: r.location.lat, lon: r.location.lon, label: r.title }] : []));
  const entities = listRecords(state, "entity");
  const cons = consequences(state);
  return (
    <div data-section="world">
      <SectionIntro
        index="01"
        numerals
        backdrop={ART.heroes.world}
        eyebrow="The World"
        title={WORLD_NAME}
        size="xl"
        lede={
          <>
            The world long after, remade twice. Drowned coasts and mountains adrift; the ruins of the Shoreborn under new peoples&rsquo; cities;
            rifts that wash in fragments of elsewhere.
          </>
        }
      >
        <p className="tracked flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.62rem] text-faint">
          <span>{WORLD_NAME_PRONUNCIATION}</span>
          <span aria-hidden="true" className="tint-rule h-px w-8" />
          <span>Teruānga: &ldquo;{WORLD_NAME_MEANING}&rdquo;</span>
        </p>
        <EraBand className="pt-4" />
      </SectionIntro>

      {/* The atlas. */}
      <section aria-labelledby="atlas-h" className="mb-24 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[38rem]">
          <Globe points={points} />
          <p className="tracked pointer-events-none absolute bottom-2 left-0 text-[0.58rem] text-faint">Orthographic · tilted · turning</p>
        </div>
        <div>
          <Reveal as="h2" className="t-display-m mb-2" decode="The atlas" />
          <p id="atlas-h" className="mb-8 max-w-md text-sm text-muted">
            Only what the sources place is drawn. Everything else waits in the margin until someone charts it.
          </p>
          {charted.length ? (
            <div className="mb-8">
              <p className="tracked mb-3 text-[0.6rem] text-faint">Charted</p>
              <PlaceList items={charted.map((c) => c.record)} href={href} />
            </div>
          ) : null}
          <div>
            <p className="tracked mb-3 text-[0.6rem] text-faint">Uncharted · {uncharted.length}</p>
            {uncharted.length ? <PlaceList items={uncharted.map((c) => c.record)} href={href} /> : <p className="text-sm text-faint">No places have been recorded yet.</p>}
          </div>
        </div>
      </section>

      {/* The long history. */}
      <section aria-labelledby="history-h" className="mb-24">
        <Reveal as="h2" className="t-display-m mb-2" decode="The long history" />
        <p id="history-h" className="mb-10 max-w-2xl text-sm text-muted">
          From the Shoreborn to the Tide. Placements are approximate; the stroke of each mark says how sure the sources are: solid, dashed, dotted.
        </p>
        <TimelineRiver entries={timeline(state)} hrefOf={href} />
      </section>

      {/* The Three Consequences. */}
      {cons.some((c) => c.entry) ? (
        <section aria-labelledby="tide-h" className="mb-24">
          <Reveal as="h2" className="t-display-m mb-2" decode="The Three Consequences" />
          <p id="tide-h" className="mb-10 max-w-2xl text-sm text-muted">
            The Tide is not one blow but a long disruption, known by what it left behind.
          </p>
          <ol className="grid gap-px overflow-hidden bg-white/[0.06] sm:grid-cols-3">
            {cons.map(({ kind, entry }, i) =>
              entry ? (
                <li key={kind} className="bg-bg">
                  <Link href={href(entry.record.id)} className="group block h-full p-6 no-underline sm:p-8">
                    <span className="flex items-center gap-4 text-white/70 group-hover:text-white">
                      <ConsequenceSigil kind={kind} size={34} />
                      <span className="tracked text-[0.6rem] text-faint">{["First", "Second", "Third"][i]} consequence</span>
                    </span>
                    <span className="t-display-m mt-6 block text-text">{entry.record.title}</span>
                    <span className="mt-3 block text-sm leading-relaxed text-muted">
                      <WorldText text={entry.record.summary} />
                    </span>
                  </Link>
                </li>
              ) : null,
            )}
          </ol>
        </section>
      ) : null}

      {/* Everything else, by kind. */}
      <section aria-labelledby="index-h" className="mb-12 border-t border-white/10 pt-10">
        <h2 id="index-h" className="tracked mb-6 text-[0.65rem] text-faint">
          The index
        </h2>
        <ul className="grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(WORLD_KIND_GROUPS).map(([slug, g]) => {
            const n = entities.filter((e) => g.kinds.includes(e.record.kind)).length;
            return (
              <li key={slug}>
                <Link href={`/world/browse/${slug}`} className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] py-3 no-underline hover:border-white/30">
                  <span className="font-[family-name:var(--font-display)] text-lg text-text">{g.label}</span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-faint">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm">
          <Link href="/world?status=active" className="text-faint">
            Browse and filter every entry →
          </Link>
        </p>
      </section>
    </div>
  );
}

function PlaceList({ items, href }: { items: { id: string; title: string; summary?: string | null; canonStatus: string }[]; href: (id: string) => string }) {
  return (
    <ul className="space-y-0">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={href(p.id)} className="group flex gap-4 border-t border-white/[0.07] py-3 no-underline">
            <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-white/60 group-hover:border-white" data-canon={p.canonStatus} />
            <span className="min-w-0">
              <span className="block text-text group-hover:text-white">
                <WorldText text={p.title} />
              </span>
              {p.summary ? (
                <span className="line-clamp-1 block text-xs text-faint">
                  <WorldText text={p.summary} />
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
