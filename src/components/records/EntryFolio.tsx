/**
 * An entry, laid out by what it is. A people (or an enclave) gets a folio in
 * the documents' own template: its portrait held in the dark beside a rail
 * of sections, its factions, its places and moments. Everything else gets a
 * quieter specimen page: where it sits in time, what it belongs to, what it
 * touches. GM material (sources, notes, workshop links, contradictions)
 * gathers in a ledger at the end, for the GM only.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { Reveal } from "@/components/motion/Reveal";
import { CanonMark } from "@/components/tide/CanonMark";
import { ConsequenceSigil } from "@/components/tide/ConsequenceSigil";
import { EraBand, eraLabel } from "@/components/tide/EraBand";
import { Plate } from "@/components/tide/Plate";
import { Redacted } from "@/components/tide/Redacted";
import { SectionRail } from "@/components/tide/SectionRail";
import { Markdown } from "@/components/ui/Markdown";
import { Notice } from "@/components/ui/States";
import type { EntityRecord } from "@/lib/contract/schema";
import { splitBody } from "@/lib/domain/body-sections";
import { backlinksFor, childrenOf, hrefFor, listRecords, relationsFor, resolveRef } from "@/lib/domain/queries";
import { redactPlain } from "@/lib/domain/redaction";
import { ENTITY_KIND_LABEL } from "@/lib/domain/sections";
import type { PublishedState, RecordState } from "@/lib/domain/types";
import { belongings, factionsOf, imageFor, isEnclave, timeline } from "@/lib/domain/views";
import type { AppContext } from "@/lib/server/context";
import { Decode } from "@/components/glyphs/Decode";
import { RefLink, RefList } from "./RefLink";
import { Relations } from "./Relations";
import { SourceRefs } from "./Sources";

export async function EntryFolio({ ctx, state, rs, section }: { ctx: AppContext; state: PublishedState; rs: RecordState; section: "world" | "people" }) {
  const r = rs.record as EntityRecord;
  const isPeople = r.kind === "people";
  const ledger = ctx.audience === "gm" || ctx.canEdit ? await Ledger({ ctx, state, r }) : null;
  return (
    <article aria-labelledby="entry-title" data-section={section} style={r.palette ? ({ "--plate-glow": r.palette } as React.CSSProperties) : undefined}>
      {rs.lifecycle === "archived" ? (
        <div className="mb-4">
          <Notice tone="warn" title="Archived">
            This entry is archived in the active release. It stays readable here, and live work linked to it is kept.
          </Notice>
        </div>
      ) : null}
      {r.demo ? (
        <div className="mb-4">
          <Notice title="Demonstration record">This record exists to show how the interface works. It is not canon.</Notice>
        </div>
      ) : null}
      {isPeople ? <PeopleFolio state={state} r={r} section={section} /> : <Specimen state={state} r={r} section={section} />}
      {ledger}
    </article>
  );
}

function Crumbs({ section, r }: { section: "world" | "people"; r: EntityRecord }) {
  return (
    <nav aria-label="Breadcrumb" className="tracked mb-6 flex flex-wrap items-center gap-2 text-[0.62rem] text-faint">
      <Link href={`/${section}`} className="text-faint no-underline hover:text-white">
        {section === "people" ? "People" : "The World"}
      </Link>
      <span aria-hidden="true">/</span>
      <span>{isEnclave(r) ? "Enclave" : r.kind === "people" ? "Peoples" : ENTITY_KIND_LABEL[r.kind]}</span>
    </nav>
  );
}

function Title({ r, className = "t-display-l" }: { r: EntityRecord; className?: string }) {
  return (
    <h1 id="entry-title" className={className}>
      <Decode text={redactPlain(r.title)} active delay={120} />
    </h1>
  );
}

/** A people or an enclave: the folio. */
function PeopleFolio({ state, r, section }: { state: PublishedState; r: EntityRecord; section: "world" | "people" }) {
  const portrait = imageFor(state, r.id);
  const { intro, sections } = splitBody(r.body);
  const factions = factionsOf(state, r.id).map((f) => f.record);
  const own = belongings(state, r.id).map((b) => b.record);
  const placesOwn = own.filter((b) => b.kind === "place" || b.kind === "environment");
  const moments = timeline(state).filter((t) => own.some((o) => o.id === t.id));
  const rail = [
    ...(intro ? [{ id: "overview", label: "Overview" }] : []),
    ...sections.map((s) => ({ id: s.id, label: s.label })),
    ...(factions.length ? [{ id: "factions", label: "Factions" }] : []),
  ];
  const href = (id: string) => hrefFor(state.records[id]) ?? "#";
  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        {/* The portrait, held while the text scrolls. */}
        <div className="lg:sticky lg:top-[calc(var(--header-h)+5rem)] lg:self-start">
          <Plate src={portrait} alt={`${r.title}, portrait`} seed={r.id} palette={r.palette} sizes="(min-width: 1024px) 22rem, 90vw" priority />
          <div className="mt-6 hidden lg:block">
            <SectionRail items={rail} />
          </div>
        </div>
        <div className="min-w-0">
          <Crumbs section={section} r={r} />
          <Title r={r} className="t-display-xl" />
          {r.aliases?.length ? <p className="tracked mt-4 text-[0.62rem] text-faint">{r.aliases.join(" · ")}</p> : null}
          {r.summary ? (
            <p className="t-lede mt-6 max-w-2xl">
              <Redacted text={r.summary} />
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <CanonMark status={r.canonStatus} showLabel />
            {r.era ? <span className="tracked text-[0.6rem] text-faint">{eraLabel(r.era)}</span> : null}
          </div>
          <div className="mt-6 lg:hidden">
            <SectionRail items={rail} />
          </div>

          {!r.body ? (
            <p className="mt-12 max-w-xl text-muted">Source material has not been supplied. This people is still being written.</p>
          ) : null}
          {intro ? (
            <section id="overview" aria-label="Overview" className="reading drop-cap mt-14 scroll-mt-32">
              <Markdown>{intro}</Markdown>
            </section>
          ) : null}
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-16 scroll-mt-32">
              <Reveal as="div" className="mb-6 flex items-center gap-4">
                {s.key === "consequences" ? <ConsequenceSigil kind="divergence" size={22} className="text-white/50" /> : <span aria-hidden="true" className="tint-rule h-px w-10" />}
                <h2 id={`${s.id}-h`} className="t-display-m">
                  <Redacted text={s.title} />
                </h2>
              </Reveal>
              <div className="reading">
                <Markdown>{s.markdown}</Markdown>
              </div>
            </section>
          ))}

          {factions.length ? (
            <section id="factions" aria-labelledby="factions-h" className="mt-20 scroll-mt-32">
              <h2 id="factions-h" className="t-display-m mb-8">
                Factions
              </h2>
              <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
                {factions.map((f) => (
                  <li key={f.id}>
                    <Link href={href(f.id)} className="group block border-t border-white/15 pt-4 no-underline">
                      <span className="t-title block text-text group-hover:text-white">
                        <Redacted text={f.title} />
                      </span>
                      {f.aliases?.[0] ? <span className="tracked block text-[0.56rem] text-faint">{f.aliases[0]}</span> : null}
                      <span className="mt-2 block text-sm leading-relaxed text-muted">
                        <Redacted text={f.summary} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {placesOwn.length || moments.length ? (
            <section aria-labelledby="world-h" className="mt-20 grid gap-10 sm:grid-cols-2">
              <h2 id="world-h" className="sr-only">
                In the world
              </h2>
              {placesOwn.length ? <SmallList title="Places" items={placesOwn} href={href} /> : null}
              {moments.length ? (
                <div>
                  <p className="tracked mb-3 text-[0.6rem] text-faint">Moments</p>
                  <ol className="space-y-0">
                    {moments.map((m) => (
                      <li key={m.id}>
                        <Link href={href(m.id)} className="group block border-t border-white/[0.07] py-3 no-underline">
                          <span className="block font-[family-name:var(--font-mono)] text-[0.58rem] text-white/40">{m.label}</span>
                          <span className="block text-text group-hover:text-white">
                            <Redacted text={m.title} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          ) : null}

          <RelationsBlock state={state} id={r.id} />
        </div>
      </div>
    </>
  );
}

/** Any other entry: a specimen page. */
function Specimen({ state, r, section }: { state: PublishedState; r: EntityRecord; section: "world" | "people" }) {
  const { intro, sections } = splitBody(r.body);
  const href = (id: string) => hrefFor(state.records[id]) ?? "#";
  const children = childrenOf(state, r.id).map((c) => c.record);
  const image = imageFor(state, r.id, "hero") ?? imageFor(state, r.id);
  const parent = r.parentId ? resolveRef(state, r.parentId) : null;
  // Before and after, on the timeline.
  const line = timeline(state);
  const at = line.findIndex((t) => t.id === r.id);
  const before = at > 0 ? line[at - 1] : null;
  const after = at >= 0 && at < line.length - 1 ? line[at + 1] : null;
  const sigil = /drowning/i.test(r.title) ? "drowning" : /divergence/i.test(r.title) ? "divergence" : /drift/i.test(r.title) ? "drift" : null;
  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="min-w-0">
          <Crumbs section={section} r={r} />
          {sigil ? <ConsequenceSigil kind={sigil} size={40} className="mb-6 text-white/70" /> : null}
          <Title r={r} />
          {r.aliases?.length ? <p className="tracked mt-4 text-[0.62rem] text-faint">Also: {r.aliases.join(" · ")}</p> : null}
          {r.summary ? (
            <p className="t-lede mt-6 max-w-2xl">
              <Redacted text={r.summary} />
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <CanonMark status={r.canonStatus} showLabel />
            {r.chronology?.label ? <span className="font-[family-name:var(--font-mono)] text-[0.66rem] text-white/50">{r.chronology.label}</span> : null}
          </div>
          {r.era ? <EraBand current={r.era} className="mt-8 max-w-3xl" /> : null}
          {r.tags?.length ? (
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1">
              {r.tags.map((t) => (
                <Link key={t} href={`/${section}?tag=${encodeURIComponent(t)}`} className="tracked text-[0.6rem] text-faint no-underline hover:text-white">
                  #{t}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
        {image ? (
          <div className="lg:pt-10">
            <Plate src={image} alt={r.title} seed={r.id} palette={r.palette} sizes="18rem" />
          </div>
        ) : null}
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="min-w-0">
          {r.body ? (
            <>
              {intro ? (
                <div className="reading drop-cap">
                  <Markdown>{intro}</Markdown>
                </div>
              ) : null}
              {sections.map((s) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-12 scroll-mt-32">
                  <h2 id={`${s.id}-h`} className="t-display-m mb-5">
                    <Redacted text={s.title} />
                  </h2>
                  <div className="reading">
                    <Markdown>{s.markdown}</Markdown>
                  </div>
                </section>
              ))}
            </>
          ) : (
            <p className="text-muted">Source material has not been supplied.</p>
          )}
          <RelationsBlock state={state} id={r.id} />
        </div>
        <aside aria-label="Where it sits" className="space-y-10 text-sm">
          {parent ? (
            <div>
              <p className="tracked mb-2 text-[0.6rem] text-faint">Part of</p>
              <RefLink r={parent} />
            </div>
          ) : null}
          {children.length ? <SmallList title="Within" items={children} href={href} /> : null}
          {before || after ? (
            <div>
              <p className="tracked mb-3 text-[0.6rem] text-faint">On the timeline</p>
              {before ? (
                <Link href={href(before.id)} className="block border-t border-white/[0.07] py-3 no-underline">
                  <span className="block font-[family-name:var(--font-mono)] text-[0.58rem] text-white/40">Before · {before.label}</span>
                  <span className="text-text">
                    <Redacted text={before.title} />
                  </span>
                </Link>
              ) : null}
              {after ? (
                <Link href={href(after.id)} className="block border-t border-white/[0.07] py-3 no-underline">
                  <span className="block font-[family-name:var(--font-mono)] text-[0.58rem] text-white/40">After · {after.label}</span>
                  <span className="text-text">
                    <Redacted text={after.title} />
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
          <AppearsIn state={state} id={r.id} />
        </aside>
      </div>
    </>
  );
}

function SmallList({ title, items, href }: { title: string; items: EntityRecord[]; href: (id: string) => string }) {
  return (
    <div>
      <p className="tracked mb-3 text-[0.6rem] text-faint">{title}</p>
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            <Link href={href(p.id)} className="group block border-t border-white/[0.07] py-3 no-underline">
              <span className="block text-text group-hover:text-white">
                <Redacted text={p.title} />
              </span>
              {p.summary ? (
                <span className="line-clamp-2 block text-xs text-faint">
                  <Redacted text={p.summary} />
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelationsBlock({ state, id }: { state: PublishedState; id: string }) {
  const relations = relationsFor(state, id).filter((r) => !/^factions?$/i.test(r.label));
  if (!relations.length) return null;
  return (
    <section aria-labelledby="rel-h" className="mt-16 border-t border-white/10 pt-8">
      <h2 id="rel-h" className="tracked mb-5 text-[0.62rem] text-faint">
        Bonds and quarrels
      </h2>
      <Relations relations={relations} />
    </section>
  );
}

function AppearsIn({ state, id }: { state: PublishedState; id: string }) {
  const refs = backlinksFor(state, id).filter((b) => b.type !== "entity");
  if (!refs.length) return null;
  return (
    <div>
      <p className="tracked mb-3 text-[0.6rem] text-faint">Appears in</p>
      <RefList refs={refs} empty="" showType />
    </div>
  );
}

/** GM material: sources, contradictions, the workshop, notes. */
async function Ledger({ ctx, state, r }: { ctx: AppContext; state: PublishedState; r: EntityRecord }): Promise<ReactNode> {
  const [prints, builds, notes] = await Promise.all([ctx.operationalStore.listPrintJobs(), ctx.operationalStore.listBuilds(), ctx.operationalStore.listGmNotes(r.id)]);
  const linkedPrints = prints.filter((p) => p.linkedRecordIds.includes(r.id));
  const linkedBuilds = builds.filter((b) => b.linkedRecordIds.includes(r.id));
  const conflicts = (r.conflicts ?? []).filter((c) => c.status === "open");
  const questions = listRecords(state, "open_question").filter((q) => q.record.status === "open" && q.record.relatedIds?.includes(r.id));
  return (
    <section aria-labelledby="ledger-h" className="ledger mt-24 border-t border-white/10 pt-8">
      <h2 id="ledger-h" className="tracked mb-8 flex items-center gap-3 text-[0.62rem] text-faint">
        <span>The GM&rsquo;s ledger</span>
        <span aria-hidden="true" className="h-px w-14 bg-white/15" />
      </h2>
      <div className="grid gap-10 text-sm md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="tracked mb-3 text-[0.58rem] text-faint">Unresolved</p>
          {conflicts.length || questions.length ? (
            <ul className="space-y-3">
              {conflicts.map((c, i) => (
                <li key={i} className="border-l border-warn/50 pl-3 text-muted">
                  {c.description}
                </li>
              ))}
              {questions.map((q) => (
                <li key={q.record.id} className="border-l border-warn/50 pl-3">
                  <span className="block text-text">
                    <Redacted text={q.record.title} />
                  </span>
                  <span className="text-xs text-muted">
                    <Redacted text={q.record.summary} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-faint">Nothing open.</p>
          )}
        </div>
        <div>
          <p className="tracked mb-3 text-[0.58rem] text-faint">Sources</p>
          <SourceRefs refs={r.sourceRefs} state={state} />
        </div>
        <div>
          <p className="tracked mb-3 text-[0.58rem] text-faint">In the workshop</p>
          {linkedPrints.length || linkedBuilds.length ? (
            <ul className="space-y-1.5">
              {linkedPrints.map((p) => (
                <li key={p.id}>
                  <Link href={`/workshop/prints/${p.id}`}>{p.title}</Link> <span className="text-faint">· print, {p.status.replace("_", "-")}</span>
                </li>
              ))}
              {linkedBuilds.map((b) => (
                <li key={b.id}>
                  <Link href={`/workshop/builds/${b.id}`}>{b.title}</Link> <span className="text-faint">· build, {b.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-faint">No print jobs or builds are linked.</p>
          )}
        </div>
        <div>
          <p className="tracked mb-3 text-[0.58rem] text-faint">GM notes</p>
          <GmNotesPanel subjectId={r.id} notes={notes} />
        </div>
      </div>
      <p className="mt-8 text-xs text-faint">Read-only. To change this entry, edit it in its ChatGPT space and publish a new release.</p>
    </section>
  );
}
