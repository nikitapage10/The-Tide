import { notFound } from "next/navigation";
import { RefList } from "@/components/records/RefLink";
import { PRINT_TONE, PrintProgress } from "@/components/live/PrintCard";
import { PrintAttemptForm, PrintJobDialog } from "@/components/live/PrintJobForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { safeHref } from "@/lib/contract/safety";
import { linkOptions } from "@/lib/domain/link-options";
import { resolveRef } from "@/lib/domain/queries";
import { requirePageContext } from "@/lib/server/page-context";

const show = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? <span className="text-faint">Not recorded</span> : v);

export default async function PrintJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePageContext();
  const job = await ctx.operationalStore.getPrintJob(id);
  if (!job) notFound();
  const [attempts, state] = await Promise.all([ctx.operationalStore.listPrintAttempts(id), ctx.publicationStore.getActiveState()]);
  const href = safeHref(job.sourceUrl);
  const d = job.dimensions;
  return (
    <article>
      <PageHeader
        crumbs={[
          { href: "/workshop", label: "The Workshop" },
          { href: "/workshop/prints", label: "Print queue" },
        ]}
        eyebrow="Print job"
        title={job.title}
        badges={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={PRINT_TONE[job.status]}>{job.status.replace("_", "-")}</Badge>
            <Badge>{job.priority} priority</Badge>
            {job.demo ? <DemoBadge /> : null}
          </span>
        }
        actions={<PrintJobDialog job={job} linkOptions={linkOptions(state)} triggerLabel="Edit" />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Card as="section" aria-labelledby="h-progress">
            <SectionHeading id="h-progress">Progress</SectionHeading>
            <PrintProgress job={job} />
            {job.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{job.notes}</p> : null}
          </Card>
          <Card as="section" aria-labelledby="h-details">
            <SectionHeading id="h-details">Details</SectionHeading>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Model / source</dt>
              <dd className="break-all">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                    {href}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  show(null)
                )}
              </dd>
              <dt className="text-muted">File reference</dt>
              <dd>{show(job.fileReference)}</dd>
              <dt className="text-muted">Format</dt>
              <dd>{show(job.fileFormat)}</dd>
              <dt className="text-muted">Printer / profile</dt>
              <dd>{show(job.printerProfile)}</dd>
              <dt className="text-muted">Material</dt>
              <dd>{show(job.material)}</dd>
              <dt className="text-muted">Scale</dt>
              <dd>{show(job.scale)}</dd>
              <dt className="text-muted">Dimensions</dt>
              <dd>{d ? `${d.x ?? "?"} × ${d.y ?? "?"} × ${d.z ?? "?"} ${d.unit}` : show(null)}</dd>
              <dt className="text-muted">Estimated duration</dt>
              <dd>{job.estimatedMinutes !== null ? `${job.estimatedMinutes} min` : show(null)}</dd>
              <dt className="text-muted">Actual duration</dt>
              <dd>{job.actualMinutes !== null ? `${job.actualMinutes} min` : show(null)}</dd>
            </dl>
          </Card>
          <Card as="section" aria-labelledby="h-links">
            <SectionHeading id="h-links">Linked lore, stories and sessions</SectionHeading>
            <RefList refs={job.linkedRecordIds.map((l) => resolveRef(state, l))} empty="Not linked to anything." showType />
          </Card>
        </div>
        <aside className="space-y-5">
          <Card as="section" aria-labelledby="h-attempt">
            <SectionHeading id="h-attempt">Record pieces</SectionHeading>
            <PrintAttemptForm job={job} />
          </Card>
          <Card as="section" aria-labelledby="h-history">
            <SectionHeading id="h-history">Attempt history</SectionHeading>
            {attempts.length ? (
              <ul className="space-y-2 text-sm">
                {attempts.map((a) => (
                  <li key={a.id} className="rounded-md border border-border p-2">
                    <span className={a.outcome === "succeeded" ? "text-ok" : "text-warn"}>
                      {a.quantity} {a.outcome}
                    </span>{" "}
                    <time className="text-faint" dateTime={a.recordedAt}>
                      {new Date(a.recordedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                    </time>
                    {a.note ? <p className="text-muted">{a.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">No attempts recorded yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </article>
  );
}
