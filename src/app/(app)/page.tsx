import Link from "next/link";
import { HomeHero, type HeroCallout, type HeroObservation } from "@/components/home/HomeHero";

/**
 * Rotating notes on the hero. Wording is taken from the GM's own documents
 * ("The Tide - Intro" and "Tide 101"); positions are on the artwork (percent).
 * "Storm cell" describes the animated weather, not lore.
 */
const OBSERVATIONS: HeroObservation[] = [
  { x: 80, y: 62, side: "left", title: "Storm cell", line: "Atmosphere unstable" },
  { x: 70, y: 22, side: "right", title: "The Drowning", line: "Coastlines lost beneath rising water" },
  { x: 76, y: 40, side: "right", title: "The Divergence", line: "Latent abilities awakened" },
  { x: 34, y: 60, side: "right", title: "The Drift", line: "Enclaves from other times" },
  { x: 74, y: 52, side: "right", title: "The Undertow", line: "First cataclysm · c. 2102 B.U." },
  { x: 78, y: 30, side: "left", title: "Age of the Veil", line: "Some seven centuries, scarcely recorded" },
  { x: 70, y: 12, side: "right", title: "Era of Verdancy", line: "The present age" },
];
import { PrintCard } from "@/components/live/PrintCard";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { EmptyState } from "@/components/ui/States";
import { RefLink } from "@/components/records/RefLink";
import { hrefFor, listRecords, resolveRef } from "@/lib/domain/queries";
import { SECTIONS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";

export default async function HomePage() {
  const ctx = await requirePageContext();
  const [state, releases, sessionStates, checklist, prints, activity] = await Promise.all([
    ctx.publicationStore.getActiveState(),
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
  const entity = (title: string) => listRecords(state, "entity").find((e) => e.record.title === title);
  const href = (title: string) => {
    const e = entity(title);
    return e ? hrefFor(e.state) : null;
  };
  const code = (title: string) => {
    const e = entity(title);
    return e ? `ID ${e.record.id.slice(0, 8)}` : undefined;
  };
  // Callouts point at real published entries; nothing here asserts new canon.
  const callouts: HeroCallout[] = [
    { x: 72, y: 70, side: "right", title: "Entry unknown", lines: ["Designation withheld"], href: href("Future Earth"), code: code("Future Earth") },
    { x: 46, y: 47, side: "right", title: "The Tide", lines: ["Origin unresolved"], href: href("The Tide (in-lore usage)"), code: code("The Tide (in-lore usage)") },
    { x: 50, y: 78, side: "left", title: "Seven cycles", lines: ["Record incomplete"], href: href("The seven cycles"), code: code("The seven cycles") },
  ];

  return (
    <>
      <HomeHero callouts={callouts} observations={OBSERVATIONS} code={latest ? `Archive · release v${latest.version}` : "Archive · no release yet"} />
      <div className="space-y-12 pt-14">
      <section aria-labelledby="observatory">
        <p className="tracked flex items-center gap-3 text-faint">
          <span>02 / Observatory</span>
          <span aria-hidden="true" className="h-px w-20 bg-white/20" />
        </p>
        <h2 id="observatory" className="mt-4 text-4xl font-light">
          The archive at a glance
        </h2>
      </section>

      <nav aria-labelledby="sections-heading">
        <h2 id="sections-heading" className="sr-only">
          Sections
        </h2>
        <ul className="grid border-l border-t border-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {SECTIONS.map((s) => (
            <li key={s.key} className="border-b border-r border-white/10">
              <Link href={s.href} className="group flex h-full flex-col gap-3 p-5 no-underline transition-tide hover:bg-white/[0.03]">
                <span className="tracked text-[0.68rem] text-faint group-hover:text-white">Enter</span>
                <span className="font-[family-name:var(--font-display)] text-2xl text-white">{s.label}</span>
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
                <h3 className="text-lg">{q.title}</h3>
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
    </>
  );
}
