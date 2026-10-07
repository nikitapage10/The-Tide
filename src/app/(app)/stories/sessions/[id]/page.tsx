import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordBadges } from "@/components/records/Badges";
import { RefLink, RefList } from "@/components/records/RefLink";
import { ChecklistPanel } from "@/components/live/ChecklistPanel";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { SessionStatePanel } from "@/components/live/SessionStatePanel";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { Notice } from "@/components/ui/States";
import { mediaFor, resolveRef } from "@/lib/domain/queries";
import { requirePageContext } from "@/lib/server/page-context";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const rs = state.records[id];
  if (!rs || rs.type !== "session") notFound();
  const [live, checklist, notes, prints] = await Promise.all([
    ctx.operationalStore.getSessionState(id),
    ctx.operationalStore.listChecklistItems(id),
    ctx.operationalStore.listGmNotes(id),
    ctx.operationalStore.listPrintJobs(),
  ]);
  const s = rs.record?.type === "session" ? rs.record : null;
  const story = s ? resolveRef(state, s.storyId) : null;
  const media = mediaFor(state, id);
  const linkedPrints = prints.filter((p) => p.linkedRecordIds.includes(id));

  return (
    <article>
      <PageHeader
        crumbs={[{ href: "/stories", label: "Stories" }, ...(story?.href ? [{ href: story.href, label: story.title }] : [])]}
        eyebrow="Session"
        title={s?.title ?? rs.tombstone?.lastTitle ?? "Removed session"}
        badges={<RecordBadges demo={s?.demo ?? false} lifecycle={rs.lifecycle} visibility={s?.visibility} />}
        description={s?.summary}
      />
      {rs.lifecycle !== "active" ? (
        <div className="mb-5">
          <Notice tone="warn" title={rs.lifecycle === "archived" ? "This session is archived" : "This session was removed from published lore"}>
            Live state, prep items and GM notes below are kept and still editable.
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="h-published" className="space-y-5">
          <h2 id="h-published" className="eyebrow">
            Published from Space Pages · read-only
          </h2>
          <Card aria-labelledby="h-prep-pub" as="section">
            <SectionHeading id="h-prep-pub">Preparation</SectionHeading>
            {s?.prep ? <Markdown>{s.prep}</Markdown> : <p className="text-muted">No published preparation material.</p>}
          </Card>
          <Card aria-labelledby="h-recap" as="section">
            <SectionHeading id="h-recap">Recap</SectionHeading>
            {s?.recap ? <Markdown>{s.recap}</Markdown> : <p className="text-muted">No recap has been published yet.</p>}
          </Card>
          <Card aria-labelledby="h-lore" as="section">
            <SectionHeading id="h-lore">Relevant lore</SectionHeading>
            {story ? (
              <p className="mb-2 text-sm">
                Story: <RefLink r={story} />
              </p>
            ) : null}
            <RefList refs={(s?.relatedIds ?? []).map((r) => resolveRef(state, r))} empty="No lore is linked to this session." showType />
          </Card>
          <Card aria-labelledby="h-music" as="section">
            <SectionHeading id="h-music">Music & art</SectionHeading>
            <RefList refs={media.map((m) => resolveRef(state, m.record.id))} empty="Nothing from The Studio is linked." showType />
          </Card>
        </section>
        <section aria-labelledby="h-live" className="space-y-5">
          <h2 id="h-live" className="eyebrow">
            Live in the dashboard · never published as canon
          </h2>
          <Card aria-labelledby="h-state" as="section">
            <SectionHeading id="h-state">Session state</SectionHeading>
            <SessionStatePanel sessionId={id} state={live} />
          </Card>
          <Card aria-labelledby="h-check" as="section">
            <SectionHeading id="h-check">Prep checklist</SectionHeading>
            <ChecklistPanel subjectId={id} items={checklist} headingId="h-check" />
          </Card>
          <Card aria-labelledby="h-prints" as="section">
            <SectionHeading id="h-prints">Print jobs for this session</SectionHeading>
            {linkedPrints.length ? (
              <ul className="space-y-1.5 text-sm">
                {linkedPrints.map((p) => (
                  <li key={p.id}>
                    <Link href={`/workshop/prints/${p.id}`}>{p.title}</Link>{" "}
                    <span className="text-faint">
                      · {p.completedQuantity}/{p.requestedQuantity} done, {p.status.replace("_", "-")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">No print jobs link to this session.</p>
            )}
          </Card>
          <Card aria-labelledby="h-gm" as="section">
            <SectionHeading id="h-gm">GM notes</SectionHeading>
            <GmNotesPanel subjectId={id} notes={notes} />
          </Card>
        </section>
      </div>
    </article>
  );
}
