import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordBadges } from "@/components/records/Badges";
import { RefList } from "@/components/records/RefLink";
import { SourceRefs } from "@/components/records/Sources";
import { CONTINUITY_LABEL, FORMAT_LABEL } from "@/components/records/StoryList";
import { ChecklistPanel } from "@/components/live/ChecklistPanel";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { EmptyState, Notice } from "@/components/ui/States";
import { mediaFor, partsForStory, relationsFor, resolveRef, sessionsForStory } from "@/lib/domain/queries";
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

  return (
    <article>
      <PageHeader
        crumbs={[{ href: "/stories", label: "Stories" }]}
        eyebrow={FORMAT_LABEL[s.format]}
        title={s.title}
        badges={
          <span className="flex flex-wrap gap-1.5">
            <RecordBadges demo={s.demo} canonStatus={s.canonStatus} lifecycle={rs.lifecycle} visibility={s.visibility} />
            <Badge tone={s.continuity === "shared_canon" ? "ok" : "neutral"}>{CONTINUITY_LABEL[s.continuity]}</Badge>
            {s.draftStatus ? <Badge tone="info">Draft: {s.draftStatus.replace("_", " ")}</Badge> : null}
          </span>
        }
        description={s.summary}
      />
      {s.continuity !== "shared_canon" ? (
        <div className="mb-5">
          <Notice title="Story continuity">
            Details in this story are {s.continuity === "story_specific" ? "specific to this story" : "not yet classified"} and are not treated as approved shared canon.
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card as="section" aria-labelledby="h-summary">
            <SectionHeading id="h-summary">Published summary</SectionHeading>
            {s.body ? <Markdown>{s.body}</Markdown> : <p className="text-muted">Source material has not been supplied.</p>}
            <p className="mt-4 text-xs text-faint">Read-only. Narrative is authored in Space Pages.</p>
          </Card>
          {playable ? (
            <Card as="section" aria-labelledby="h-sessions">
              <SectionHeading id="h-sessions">Sessions</SectionHeading>
              {sessions.length ? (
                <ol className="divide-y divide-border rounded-md border border-border">
                  {sessions.map(({ record: x, state: st }) => {
                    const live = sessionStates.find((l) => l.sessionId === x.id);
                    return (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <Link href={`/stories/sessions/${x.id}`}>{x.title}</Link>
                        <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                          <Badge tone="info">{(live?.status ?? "planned").replace("_", " ")}</Badge>
                          {live?.scheduledFor ? <span>{live.scheduledFor}</span> : null}
                          <RecordBadges demo={x.demo} lifecycle={st.lifecycle} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState title="No sessions have been published for this story." />
              )}
            </Card>
          ) : null}
          {parts.length || !playable ? (
            <Card as="section" aria-labelledby="h-parts">
              <SectionHeading id="h-parts">Outline, chapters and scenes</SectionHeading>
              {parts.length ? (
                <ol className="space-y-3">
                  {parts.map(({ record: p, state: st }) => (
                    <li key={p.id} id={`part-${p.id}`} className="rounded-md border border-border p-3">
                      <p className="eyebrow">{p.partType}</p>
                      <p className="font-medium">{p.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <RecordBadges demo={p.demo} lifecycle={st.lifecycle} />
                        {p.draftStatus ? <Badge tone="info">Draft: {p.draftStatus}</Badge> : null}
                      </div>
                      {p.summary ? <p className="mt-1 text-sm text-muted">{p.summary}</p> : null}
                      {p.viewpointIds?.length ? (
                        <p className="mt-1 text-sm">
                          Viewpoint: {p.viewpointIds.map((v) => resolveRef(state, v).title).join(", ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="No outline, chapters or scenes have been published." />
              )}
            </Card>
          ) : null}
          <Card as="section" aria-labelledby="h-cast">
            <SectionHeading id="h-cast">People, places and lore</SectionHeading>
            {viewpoints.length ? (
              <>
                <h3 className="mb-1 text-sm font-medium text-muted">Viewpoint characters</h3>
                <div className="mb-3">
                  <RefList refs={viewpoints} empty="" />
                </div>
              </>
            ) : null}
            <RefList refs={[...related, ...relations.map((r) => r.other)]} empty="No linked lore has been published." showType />
          </Card>
        </div>
        <aside className="space-y-5" aria-label="Story workspace">
          {playable ? (
            <Card as="section" aria-labelledby="h-prep">
              <SectionHeading id="h-prep">Campaign prep (live)</SectionHeading>
              <ChecklistPanel subjectId={id} items={checklist} headingId="h-prep" />
            </Card>
          ) : null}
          <Card as="section" aria-labelledby="h-media">
            <SectionHeading id="h-media">Music & art</SectionHeading>
            <RefList refs={media.map((m) => resolveRef(state, m.record.id))} empty="Nothing from The Studio is linked." showType />
          </Card>
          <Card as="section" aria-labelledby="h-builds">
            <SectionHeading id="h-builds">Physical builds & prints</SectionHeading>
            {linkedPrints.length || linkedBuilds.length ? (
              <ul className="space-y-1.5 text-sm">
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
              <p className="text-sm text-faint">No print jobs or builds are linked.</p>
            )}
          </Card>
          <Card as="section" aria-labelledby="h-src">
            <SectionHeading id="h-src">Sources</SectionHeading>
            <SourceRefs refs={s.sourceRefs} state={state} />
          </Card>
          <Card as="section" aria-labelledby="h-notes">
            <SectionHeading id="h-notes">GM notes</SectionHeading>
            <GmNotesPanel subjectId={id} notes={notes} />
          </Card>
        </aside>
      </div>
    </article>
  );
}
