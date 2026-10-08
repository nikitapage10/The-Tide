import { readFile } from "node:fs/promises";
import path from "node:path";
import { PublishingWorkbench } from "@/components/publishing/PublishingWorkbench";
import { RollbackButton } from "@/components/publishing/RollbackButton";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { EmptyState, Notice } from "@/components/ui/States";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "Publishing" };

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC";

export default async function PublishingPage() {
  const ctx = await requirePageContext();
  const [project, releases, events] = await Promise.all([
    ctx.publicationStore.getProject(),
    ctx.publicationStore.listReleases(),
    ctx.publicationStore.listPublicationEvents(20),
  ]);
  // The demo example, prepared against whichever release is active now.
  const exampleRaw = ctx.mode === "demo" ? await readFile(path.join(process.cwd(), "fixtures/publication/example-minimal.json"), "utf8").catch(() => null) : null;
  const example = exampleRaw ? JSON.stringify({ ...JSON.parse(exampleRaw), baseReleaseId: project.activeReleaseId }, null, 2) : null;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "The Workshop" }]}
        title="Publishing"
        description="Space Pages remain the authoritative home for lore. A release changes the dashboard only when it is validated here and explicitly published, either by a GM on this page or by the authenticated machine publisher."
      />
      <div className="mb-5">
        <Notice title="No live sync">
          There is no Pages API, webhook or automatic sync. Bundles are produced separately (for example by a ChatGPT-managed export) and imported here. See docs/PUBLICATION_CONTRACT.md.
        </Notice>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card as="section" aria-labelledby="h-import">
          <SectionHeading id="h-import">Import a release</SectionHeading>
          <p className="mb-3 text-sm text-muted">
            Active release: <code>{project.activeReleaseId ?? "none"}</code> (version {project.releaseCount}). New bundles must name it as <code>baseReleaseId</code>.
          </p>
          <PublishingWorkbench exampleBundle={example} />
        </Card>
        <div className="space-y-5">
          <Card as="section" aria-labelledby="h-history">
            <SectionHeading id="h-history">Release history</SectionHeading>
            {releases.length ? (
              <ol className="space-y-2">
                {releases.map((r) => (
                  <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">Version {r.version}</span>
                      <span className="flex gap-1.5">
                        {r.kind === "rollback" ? <Badge tone="warn">rollback</Badge> : null}
                        {r.id === project.activeReleaseId ? <Badge tone="ok">active</Badge> : null}
                      </span>
                    </div>
                    {r.title ? <p className="mt-1">{r.title}</p> : null}
                    <p className="text-xs text-faint">
                      {fmt(r.publishedAt)} · {r.publishedBy.label} · +{r.counts.added} ~{r.counts.changed} −{r.counts.archived + r.counts.tombstoned}
                    </p>
                    <p className="break-all font-mono text-[0.7rem] text-faint">{r.id}</p>
                    {r.id !== project.activeReleaseId ? (
                      <div className="mt-2">
                        <RollbackButton targetReleaseId={r.id} targetVersion={r.version} activeReleaseId={project.activeReleaseId} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nothing has been published yet." />
            )}
          </Card>
          <Card as="section" aria-labelledby="h-audit">
            <SectionHeading id="h-audit">Publication audit</SectionHeading>
            {events.length ? (
              <ul className="space-y-1.5 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={e.outcome === "applied" ? "ok" : e.outcome === "replayed" ? "info" : "danger"}>{e.outcome}</Badge>
                    {e.code ? <code className="text-xs">{e.code}</code> : null}
                    <span className="text-xs text-faint">
                      {fmt(e.at)} · {e.actor.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">No publication attempts recorded yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
