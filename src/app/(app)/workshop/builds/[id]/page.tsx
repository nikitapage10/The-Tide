import { notFound } from "next/navigation";
import { RefList } from "@/components/records/RefLink";
import { BuildDialog, BuildVersionForm } from "@/components/live/BuildForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { safeHref } from "@/lib/contract/safety";
import { linkOptions } from "@/lib/domain/link-options";
import { resolveRef } from "@/lib/domain/queries";
import { requirePageContext } from "@/lib/server/page-context";

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePageContext();
  const build = await ctx.operationalStore.getBuild(id);
  if (!build) notFound();
  const state = await ctx.publicationStore.getActiveState();
  return (
    <article>
      <PageHeader
        crumbs={[
          { href: "/workshop", label: "The Workshop" },
          { href: "/workshop/builds", label: "Builds" },
        ]}
        eyebrow={`Build · ${build.category}`}
        title={build.title}
        badges={
          <span className="flex gap-1.5">
            <Badge tone="info">{build.status.replace("_", " ")}</Badge>
            {build.demo ? <DemoBadge /> : null}
          </span>
        }
        description={build.purpose}
        actions={<BuildDialog build={build} linkOptions={linkOptions(state)} triggerLabel="Edit" />}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card as="section" aria-labelledby="h-links">
          <SectionHeading id="h-links">Source and file links</SectionHeading>
          {build.links.length ? (
            <ul className="space-y-1 text-sm">
              {build.links.map((l, i) => {
                const href = safeHref(l.url);
                return (
                  <li key={i}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                        {l.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      l.label
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-faint">No links recorded.</p>
          )}
          {build.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{build.notes}</p> : null}
        </Card>
        <Card as="section" aria-labelledby="h-related">
          <SectionHeading id="h-related">Related story or lore</SectionHeading>
          <RefList refs={build.linkedRecordIds.map((l) => resolveRef(state, l))} empty="Not linked to anything." showType />
        </Card>
        <Card as="section" aria-labelledby="h-versions" className="lg:col-span-2">
          <SectionHeading id="h-versions">Versions</SectionHeading>
          {build.versions.length ? (
            <ol className="mb-4 space-y-2 text-sm">
              {build.versions.map((v) => {
                const href = safeHref(v.url);
                return (
                  <li key={v.id} className="rounded-md border border-border p-2">
                    <span className="font-medium">{v.label}</span>{" "}
                    <time className="text-faint" dateTime={v.recordedAt}>
                      {new Date(v.recordedAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}
                    </time>
                    {href ? (
                      <>
                        {" · "}
                        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                          link
                        </a>
                      </>
                    ) : null}
                    {v.note ? <p className="text-muted">{v.note}</p> : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mb-4 text-sm text-faint">No versions recorded.</p>
          )}
          <BuildVersionForm build={build} />
        </Card>
      </div>
    </article>
  );
}
