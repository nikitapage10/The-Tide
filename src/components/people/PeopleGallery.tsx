/**
 * People, as a gallery: the hall of the peoples (tall plates, each lit by its
 * own colour), the arrivals (enclaves washed in by the Drift), the
 * constellation of factions, and the rest (characters, creatures) on the wall.
 */
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { CanonMark } from "@/components/tide/CanonMark";
import { ConsequenceSigil } from "@/components/tide/ConsequenceSigil";
import { Plate } from "@/components/tide/Plate";
import { WorldText } from "@/components/tide/WorldText";
import { SectionIntro } from "@/components/tide/SectionIntro";
import type { EntityRecord } from "@/lib/contract/schema";
import { hrefFor, listRecords } from "@/lib/domain/queries";
import { PEOPLE_KIND_GROUPS } from "@/lib/domain/sections";
import type { PublishedState } from "@/lib/domain/types";
import { enclaves, factionsOf, imageFor, ofKinds, peoples } from "@/lib/domain/views";
import { Constellation } from "./Constellation";

export function PeopleGallery({ state }: { state: PublishedState }) {
  const href = (id: string) => hrefFor(state.records[id]) ?? "/people";
  // Written peoples first, then those still to come.
  const hall = peoples(state).sort((a, b) => Number(!a.record.body) - Number(!b.record.body));
  const arrivals = enclaves(state);
  const wall = ofKinds(state, ["character", "creature"]);
  const entities = listRecords(state, "entity");
  const stars = hall.map(({ record }) => ({ record, factions: factionsOf(state, record.id).map((f) => f.record), href: href(record.id), factionHref: href }));
  const links = listRecords(state, "relationship").map((r) => r.record);
  return (
    <div data-section="people">
      <SectionIntro
        index="02"
        eyebrow="People"
        title="The Peoples"
        lede="Born of adaptation: forms merging flesh with stone, light with shadow, mechanism with life. Each remembers little of the world before."
      />

      {/* The hall. */}
      <section aria-labelledby="hall-h" className="mb-24">
        <div className="mb-6 flex items-end justify-between gap-6">
          <Reveal as="h2" className="t-display-m" decode="The hall" />
          <p id="hall-h" className="hidden max-w-sm text-right text-sm text-muted sm:block">
            The eight peoples of the world. Portraits from the GM&rsquo;s documents.
          </p>
        </div>
        <ol className="corridor -mx-1 flex gap-5 overflow-x-auto px-1 pb-4">
          {hall.map(({ record: p }, i) => (
            <li key={p.id} className="w-[15rem] shrink-0 sm:w-[17rem]">
              <Reveal delay={i * 90}>
                <Plate
                  src={imageFor(state, p.id)}
                  alt={`${p.title}, portrait`}
                  seed={p.id}
                  palette={p.palette}
                  href={href(p.id)}
                  sizes="17rem"
                  priority={i < 4}
                  caption={<PlateCaption p={p} n={i + 1} />}
                />
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* The arrivals. */}
      {arrivals.length ? (
        <section aria-labelledby="arrivals-h" className="mb-24">
          <div className="mb-8 flex items-center gap-4">
            <ConsequenceSigil kind="drift" size={30} className="text-white/60" />
            <Reveal as="h2" className="t-display-m" decode="Arrivals" />
          </div>
          <p id="arrivals-h" className="mb-8 max-w-2xl text-sm text-muted">
            Washed in by the Drift: fragments of other times, holding on in enclaves, living paradoxes on a world that half-remembers them.
          </p>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {arrivals.map(({ record: e }) => (
              <li key={e.id}>
                <Link href={href(e.id)} className="group block border-t border-white/15 pt-4 no-underline">
                  <span className="t-title block text-text group-hover:text-white">
                    <WorldText text={e.title} />
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted">
                    <WorldText text={e.summary} />
                  </span>
                  <CanonMark status={e.canonStatus} className="mt-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The constellation. */}
      {stars.some((s) => s.factions.length) ? (
        <section aria-labelledby="factions-h" className="mb-24">
          <Reveal as="h2" className="t-display-m mb-2" decode="Factions and bonds" />
          <p id="factions-h" className="mb-6 max-w-2xl text-sm text-muted">
            The Divergence split every people. Each star is a people; the small ones around it, its factions; the long lines, what the sources record between them.
          </p>
          <Constellation stars={stars} links={links} />
        </section>
      ) : null}

      {/* Characters and creatures. */}
      {wall.length ? (
        <section aria-labelledby="wall-h" className="mb-24">
          <Reveal as="h2" className="t-display-m mb-8" decode="Faces and creatures" />
          <ul id="wall-h" className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {wall.map(({ record: c }) => (
              <li key={c.id}>
                <Plate
                  src={imageFor(state, c.id)}
                  alt={c.title}
                  seed={c.id}
                  ratio="1 / 1"
                  href={href(c.id)}
                  sizes="12rem"
                  caption={
                    <>
                      <span className="block text-sm text-text">
                        <WorldText text={c.title} />
                      </span>
                      <span className="tracked text-[0.56rem] text-faint">{c.kind}</span>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="pindex-h" className="mb-12 border-t border-white/10 pt-10">
        <h2 id="pindex-h" className="tracked mb-6 text-[0.65rem] text-faint">
          The index
        </h2>
        <ul className="grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(PEOPLE_KIND_GROUPS).map(([slug, g]) => (
            <li key={slug}>
              <Link href={`/people/browse/${slug}`} className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] py-3 no-underline hover:border-white/30">
                <span className="font-[family-name:var(--font-display)] text-lg text-text">{g.label}</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-faint">{entities.filter((e) => g.kinds.includes(e.record.kind)).length}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm">
          <Link href="/people?status=active" className="text-faint">
            Browse and filter every entry →
          </Link>
        </p>
      </section>
    </div>
  );
}

function PlateCaption({ p, n }: { p: EntityRecord; n: number }) {
  return (
    <span className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="t-title text-text">
          <WorldText text={p.title} />
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">{String(n).padStart(2, "0")}</span>
      </span>
      {p.aliases?.[0] ? <span className="tracked block text-[0.56rem] text-faint">{p.aliases[0]}</span> : null}
      <span className="mt-2 line-clamp-3 block text-[0.82rem] leading-snug text-muted">
        <WorldText text={p.summary} />
      </span>
      <CanonMark status={p.canonStatus} className="mt-2" />
    </span>
  );
}
