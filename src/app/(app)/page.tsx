import Link from "next/link";
import { PrintCard } from "@/components/live/PrintCard";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { ProceduralMark } from "@/components/ui/ProceduralMark";
import { EmptyState } from "@/components/ui/States";
import { RefLink } from "@/components/records/RefLink";
import { listRecords, resolveRef } from "@/lib/domain/queries";
import { SECTIONS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";

export default async function HomePage() {
  const ctx = await requirePageContext();
  const [state, project, releases, sessionStates, checklist, prints, activity] = await Promise.all([
    ctx.publicationStore.getActiveState(),
    ctx.publicationStore.getProject(),
    ctx.publicationStore.listReleases(),
    ctx.operationalStore.listSessionStates(),
    ctx.operationalStore.listChecklistItems(),
    ctx.operationalStore.listPrintJobs(),
    ctx.operationalStore.listActivity(8),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessionStates
    .filter((s) => s.scheduledFor && s.scheduledFor >= today && !["completed", "canceled"].includes(s.status))
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
  const next = upcoming[0];
  const openItems = checklist.filter((c) => !c.done);
  const inProgress = prints.filter((p) => ["ready", "printing", "post_processing"].includes(p.status));
  const latest = releases[0];
  const questions = listRecords(state, "open_question").filter((q) => q.record.status === "open");

  return (
    <div className="space-y-10">
      <section aria-labelledby="intro" className="contour-bg rounded-[var(--radius)] border border-border p-6 sm:p-8">
        <p className="eyebrow">Archive · {project.name}</p>
        <h1 id="intro" className="mt-2 text-4xl sm:text-5xl">
          The Tide
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-muted">
          A homebrew science-fiction Daggerheart setting on a transformed future Earth. The world is shown here as it has been documented so far, fragment by fragment, from published Space Pages.
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="warn">Planet name undecided</Badge>
          <span className="text-faint">“Primus” is the former working name found in historical sources.</span>
        </p>
      </section>

      <nav aria-labelledby="sections-heading">
        <h2 id="sections-heading" className="mb-3 text-2xl">
          Sections
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <Link href={s.href} className="flex h-full flex-col gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 no-underline hover:border-accent/60">
                <ProceduralMark seed={s.key} size={40} />
                <span className="font-[family-name:var(--font-display)] text-xl text-text">{s.label}</span>
                <span className="text-sm text-muted">{s.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card as="section" aria-labelledby="h-next">
          <SectionHeading id="h-next">Next session</SectionHeading>
          {next ? (
            <div className="space-y-1">
              <RefLink r={resolveRef(state, next.sessionId)} />
              <p className="text-sm text-muted">
                Scheduled for <time dateTime={next.scheduledFor!}>{next.scheduledFor}</time> · {next.status.replace("_", " ")}
              </p>
              {upcoming.length > 1 ? <p className="text-xs text-faint">{upcoming.length - 1} more scheduled after this.</p> : null}
            </div>
          ) : (
            <EmptyState title="No session is scheduled.">Set a date on a session page under Stories.</EmptyState>
          )}
        </Card>

        <Card as="section" aria-labelledby="h-prep">
          <SectionHeading id="h-prep" action={<Badge>{openItems.length} open</Badge>}>
            Open prep items
          </SectionHeading>
          {openItems.length ? (
            <ul className="space-y-1.5 text-sm">
              {openItems.slice(0, 5).map((c) => {
                const subject = resolveRef(state, c.subjectId);
                return (
                  <li key={c.id}>
                    <span>{c.label}</span> {c.demo ? <DemoBadge /> : null}
                    <span className="block text-xs text-faint">
                      for{" "}
                      {subject.href ? (
                        <Link href={subject.href} className="text-faint underline">
                          {subject.title}
                        </Link>
                      ) : (
                        subject.title
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nothing left to prepare." />
          )}
        </Card>

        <Card as="section" aria-labelledby="h-release">
          <SectionHeading id="h-release">Latest release</SectionHeading>
          {latest ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-semibold">Version {latest.version}</span> {latest.kind === "rollback" ? <Badge tone="warn">rollback</Badge> : null}
              </p>
              {latest.title ? <p>{latest.title}</p> : null}
              <p className="text-xs text-faint">
                {fmt(latest.publishedAt)} · {latest.publishedBy.label}
              </p>
              <Link href="/workshop/publishing" className="text-sm">
                Release history
              </Link>
            </div>
          ) : (
            <EmptyState title="Nothing has been published yet." />
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="h-prints">
          <SectionHeading id="h-prints" action={<Link href="/workshop/prints">Print queue</Link>}>
            Prints in progress
          </SectionHeading>
          {inProgress.length ? (
            <ul className="grid gap-3">
              {inProgress.slice(0, 4).map((p) => (
                <PrintCard key={p.id} job={p} />
              ))}
            </ul>
          ) : (
            <EmptyState title="No prints are in progress." />
          )}
        </section>

        <Card as="section" aria-labelledby="h-activity">
          <SectionHeading id="h-activity">Recent live activity</SectionHeading>
          {activity.length ? (
            <ul className="space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id}>
                  {a.summary} {a.demo ? <DemoBadge /> : null}
                  <span className="block text-xs text-faint">
                    {fmt(a.at)} · {a.actorLabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No live activity yet.">Checklist, session, print and build changes appear here.</EmptyState>
          )}
        </Card>
      </div>

      <section aria-labelledby="open-questions-h" id="open-questions">
        <SectionHeading id="open-questions-h">Unresolved lore</SectionHeading>
        <p className="mb-3 text-sm text-muted">Recorded so they are not filled in by guesswork. Resolve them in Space Pages, then publish.</p>
        {questions.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {questions.map(({ record: q }) => (
              <li key={q.id} className="rounded-[var(--radius)] border border-warn/40 bg-surface p-4">
                <h3 className="font-[family-name:var(--font-body)] text-base font-semibold">{q.title}</h3>
                {q.summary ? <p className="mt-1 text-sm text-muted">{q.summary}</p> : null}
                {q.body ? (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-accent-strong">Details</summary>
                    <Markdown>{q.body}</Markdown>
                  </details>
                ) : null}
                {q.relatedIds?.length ? (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {q.relatedIds.map((id) => (
                      <RefLink key={id} r={resolveRef(state, id)} />
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No open lore questions are recorded." />
        )}
      </section>
    </div>
  );
}
