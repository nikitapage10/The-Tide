import { notFound } from "next/navigation";
import { RecordBadges } from "@/components/records/Badges";
import { RefList } from "@/components/records/RefLink";
import { SourceRefs } from "@/components/records/Sources";
import { MEDIA_TYPE_LABEL, STAGE_LABEL, stageTone } from "@/components/records/StudioBrowser";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { ProceduralMark } from "@/components/ui/ProceduralMark";
import { Notice } from "@/components/ui/States";
import { safeHref } from "@/lib/contract/safety";
import { resolveRef } from "@/lib/domain/queries";
import { requirePageContext } from "@/lib/server/page-context";

export default async function StudioItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const rs = state.records[id];
  if (!rs?.record || rs.record.type !== "media") notFound();
  const m = rs.record;
  const href = safeHref(m.url);
  const notes = await ctx.operationalStore.listGmNotes(id);
  return (
    <article>
      <PageHeader
        crumbs={[{ href: "/studio", label: "The Studio" }]}
        eyebrow={MEDIA_TYPE_LABEL[m.mediaType]}
        title={m.title}
        badges={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={stageTone(m.stage)}>{STAGE_LABEL[m.stage]}</Badge>
            <RecordBadges demo={m.demo} lifecycle={rs.lifecycle} visibility={m.visibility} />
          </span>
        }
        description={m.summary}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card as="section" aria-labelledby="h-asset">
            <SectionHeading id="h-asset">Item</SectionHeading>
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <ProceduralMark seed={m.id} size={120} />
                <p className="mt-1 w-[120px] text-[0.7rem] text-faint">Placeholder pattern. The linked item is not loaded automatically.</p>
              </div>
              <div className="space-y-3 text-sm">
                {href ? (
                  <p>
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium">
                      Open external link<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <span className="block break-all text-xs text-faint">{href}</span>
                  </p>
                ) : null}
                {m.asset ? (
                  ctx.signAsset ? (
                    <p>
                      <a href={`/api/v1/assets/${m.id}`} target="_blank" rel="noopener noreferrer">
                        Open private asset<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                      <span className="block text-xs text-faint">A short-lived link is issued after your access is checked.</span>
                    </p>
                  ) : (
                    <Notice tone="warn" title="Private asset unavailable">
                      Private storage is not configured in local demo mode. Connect Supabase Storage to open this item.
                    </Notice>
                  )
                ) : null}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted">Creator</dt>
                  <dd>{m.attribution?.creator ?? "Not supplied"}</dd>
                  <dt className="text-muted">License</dt>
                  <dd>{m.attribution?.license ?? "Not supplied"}</dd>
                </dl>
              </div>
            </div>
            {m.body ? (
              <div className="mt-4">
                <Markdown>{m.body}</Markdown>
              </div>
            ) : null}
          </Card>
          <Card as="section" aria-labelledby="h-linked">
            <SectionHeading id="h-linked">Linked to</SectionHeading>
            <RefList refs={(m.linkedIds ?? []).map((l) => resolveRef(state, l))} empty="Not linked to any entry, story or session." showType />
          </Card>
        </div>
        <aside className="space-y-5">
          <Card as="section" aria-labelledby="h-src">
            <SectionHeading id="h-src">Sources</SectionHeading>
            <SourceRefs refs={m.sourceRefs} state={state} />
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
