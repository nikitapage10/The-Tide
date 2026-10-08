import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordBadges } from "@/components/records/Badges";
import { RefList } from "@/components/records/RefLink";
import { SourceRefs } from "@/components/records/Sources";
import { CONTINUITY_LABEL, FORMAT_LABEL } from "@/components/records/StoryList";
import { ChecklistPanel } from "@/components/live/ChecklistPanel";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { Decode } from "@/components/glyphs/Decode";
import { CanonMark } from "@/components/tide/CanonMark";
import { Redacted } from "@/components/tide/Redacted";
import { Badge } from "@/components/ui/Badge";
import { Markdown } from "@/components/ui/Markdown";
import { EmptyState, Notice } from "@/components/ui/States";
import { mediaFor, partsForStory, relationsFor, resolveRef, sessionsForStory } from "@/lib/domain/queries";
import { redactPlain } from "@/lib/domain/redaction";
import { requirePageContext } from "@/lib/server/page-context";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const rs = state.records[id];
  if (!rs?.record || rs.record.type !== "story") notFound();
  const s = rs.record;
  const playable = s.format === "campaign" || s.format === "one_shot";
  const sessions = sessionsForStory(state, id);
  const sessionIds = new Set(sessions.map((x) => x.record.id));
  const parts = partsForStory(state, id);
  const [checklist, notes, prints, builds, sessionStates] = await Promise.all([
    ctx.operationalStore.listChecklistItems(id),
    ctx.operationalStore.listGmNotes(id),
    ctx.operationalStore.listPrintJobs(),
    ctx.operationalStore.listBuilds(),
    ctx.operationalStore.listSessionStates(),
  ]);
  const linkedPrints = prints.filter((p) => p.linkedRecordIds.includes(id) || p.linkedRecordIds.some((l) => sessionIds.has(l)));
  const linkedBuilds = builds.filter((b) => b.linkedRecordIds.includes(id));
  const related = (s.relatedIds ?? []).map((r) => resolveRef(state, r));
  const viewpoints = (s.viewpointIds ?? []).map((r) => resolveRef(state, r));
  const media = mediaFor(state, id);
  const relations = relationsFor(state, id);

  const gm = ctx.audience === "gm" || ctx.canEdit;
  return (
    <article data-section="stories" aria-labelledby="story-title">
      {/* The title page. */}
      <header className="mx-auto mb-16 max-w-3xl pt-6 text-center">
        <nav aria-label="Breadcrumb" className="tracked mb-10 text-[0.62rem] text-faint">
          <Link href="/stories" className="text-faint no-underline hover:text-white">
            The Library
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{FORMAT_LABEL[s.format]}</span>
        </nav>
        <span aria-hidden="true" className="tint-rule mx-auto mb-10 block h-px w-16" />
        <h1 id="story-title" className="t-display-xl">
          <Decode text={redactPlain(s.title)} active delay={120} />
        </h1>
        {s.summary ? (
          <p className="t-lede mx-auto mt-8 max-w-xl">
            <Redacted text={s.summary} />
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <CanonMark status={s.canonStatus} showLabel />
          <span className="tracked text-[0.6rem] text-faint">{CONTINUITY_LABEL[s.continuity]}</span>
          {s.draftStatus ? <span className="tracked text-[0.6rem] text-faint">{s.draftStatus.replace("_", " ")}</span> : null}
          {s.demo ? <Badge tone="demo">Demo</Badge> : null}
          {rs.lifecycle !== "active" ? <RecordBadges demo={false} lifecycle={rs.lifecycle} /> : null}
        </div>
        <span aria-hidden="true" className="tint-rule mx-auto mt-10 block h-px w-16" />
      </header>

      {s.continuity !== "shared_canon" ? (
        <div className="mx-auto mb-10 max-w-2xl">
          <Notice title="Story continuity">
            Details in this story are {s.continuity === "story_specific" ? "specific to this story" : "not yet classified"} and are not treated as approved shared canon.
          </Notice>
        </div>
      ) : null}

      {/* Contents. */}
      {parts.length ? (
        <section aria-labelledby="h-parts" className="mx-auto mb-16 max-w-2xl">
          <h2 id="h-parts" className="tracked mb-6 text-center text-[0.62rem] text-faint">
            Contents
          </h2>
          <ol>
            {parts.map(({ record: p, state: st }, i) => (
              <li key={p.id} id={`part-${p.id}`} className="border-t border-white/[0.07] py-4">
                <span className="toc-row">
                  <span className="font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">{String(p.sequence ?? i + 1).padStart(2, "0")}</span>
                  <span className="t-title text-text">
                    <Redacted text={p.title} />
                  </span>
                  <span aria-hidden="true" className="toc-fill" />
                  <span className="tracked text-[0.56rem] text-faint">{p.partType}</span>
                </span>
                {p.summary ? (
                  <p className="mt-1 pl-8 font-[family-name:var(--font-display)] italic text-muted">
                    <Redacted text={p.summary} />
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1.5 pl-8">
                  <RecordBadges demo={p.demo} lifecycle={st.lifecycle} />
                  {p.draftStatus ? <Badge tone="info">Draft: {p.draftStatus}</Badge> : null}
                  {p.viewpointIds?.length ? <span className="text-sm text-faint">Viewpoint: {p.viewpointIds.map((v) => resolveRef(state, v).title).join(", ")}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* The text. */}
      <section aria-label="Text" className="mx-auto mb-20 max-w-[64ch]">
        {s.body ? (
          <div className="reading drop-cap">
            <Markdown>{s.body}</Markdown>
          </div>
        ) : (
          <p className="text-center text-muted">Source material has not been supplied.</p>
        )}
      </section>

      {/* A campaign's voyage: its sessions as ports along one line. */}
      {playable ? (
        <section aria-labelledby="h-sessions" className="mb-20">
          <h2 id="h-sessions" className="t-display-m mb-8">
            The voyage
          </h2>
          {sessions.length ? (
            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <ol className="relative flex min-w-max gap-10 pt-6">
                <span aria-hidden="true" className="tint-rule absolute left-0 right-0 top-[1.85rem] h-px" />
                {sessions.map(({ record: x, state: st }, i) => {
                  const live = sessionStates.find((l) => l.sessionId === x.id);
                  const done = live?.status === "completed";
                  return (
                    <li key={x.id} className="relative w-44">
                      <span aria-hidden="true" className={`relative z-[1] mb-4 block h-3.5 w-3.5 rounded-full border ${done ? "border-white bg-white" : "border-white/70 bg-bg"}`} />
                      <span className="block font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">Port {String(x.sequence ?? i + 1).padStart(2, "0")}</span>
                      <Link href={`/stories/sessions/${x.id}`} className="t-title block text-text">
                        <Redacted text={x.title} />
                      </Link>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                        <Badge tone="info">{(live?.status ?? "planned").replace("_", " ")}</Badge>
                        {live?.scheduledFor ? <span>{live.scheduledFor}</span> : null}
                        <RecordBadges demo={x.demo} lifecycle={st.lifecycle} />
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <EmptyState title="No sessions have been published for this story." />
          )}
        </section>
      ) : null}

      {viewpoints.length || related.length || relations.length ? (
        <section aria-labelledby="h-cast" className="mb-16 border-t border-white/10 pt-8">
          <h2 id="h-cast" className="tracked mb-5 text-[0.62rem] text-faint">
            People, places and lore
          </h2>
          {viewpoints.length ? (
            <div className="mb-4">
              <h3 className="mb-1 text-sm text-muted">Viewpoint characters</h3>
              <RefList refs={viewpoints} empty="" />
            </div>
          ) : null}
          <RefList refs={[...related, ...relations.map((r) => r.other)]} empty="" showType />
        </section>
      ) : null}

      {/* The GM's workspace. */}
      {gm ? (
        <section aria-labelledby="h-ledger" className="mt-16 border-t border-white/10 pt-8">
          <h2 id="h-ledger" className="tracked mb-8 text-[0.62rem] text-faint">
            The GM&rsquo;s ledger
          </h2>
          <div className="grid gap-10 text-sm md:grid-cols-2 lg:grid-cols-3">
            {playable ? (
              <div>
                <h3 id="h-prep" className="tracked mb-3 text-[0.58rem] text-faint">
                  Campaign prep (live)
                </h3>
                <ChecklistPanel subjectId={id} items={checklist} headingId="h-prep" />
              </div>
            ) : null}
            <div>
              <h3 className="tracked mb-3 text-[0.58rem] text-faint">Music & art</h3>
              <RefList refs={media.map((m) => resolveRef(state, m.record.id))} empty="Nothing from The Studio is linked." showType />
            </div>
            <div>
              <h3 className="tracked mb-3 text-[0.58rem] text-faint">Physical builds & prints</h3>
              {linkedPrints.length || linkedBuilds.length ? (
                <ul className="space-y-1.5">
                  {linkedPrints.map((p) => (
                    <li key={p.id}>
                      <Link href={`/workshop/prints/${p.id}`}>{p.title}</Link> <span className="text-faint">· {p.completedQuantity}/{p.requestedQuantity}, {p.status.replace("_", "-")}</span>
                    </li>
                  ))}
                  {linkedBuilds.map((b) => (
                    <li key={b.id}>
                      <Link href={`/workshop/builds/${b.id}`}>{b.title}</Link> <span className="text-faint">· build</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-faint">No print jobs or builds are linked.</p>
              )}
            </div>
            <div>
              <h3 className="tracked mb-3 text-[0.58rem] text-faint">Sources</h3>
              <SourceRefs refs={s.sourceRefs} state={state} />
            </div>
            <div>
              <h3 className="tracked mb-3 text-[0.58rem] text-faint">GM notes</h3>
              <GmNotesPanel subjectId={id} notes={notes} />
            </div>
          </div>
          <p className="mt-8 text-xs text-faint">Read-only. Narrative is written in the ChatGPT spaces and published here.</p>
        </section>
      ) : null}
    </article>
  );
}
