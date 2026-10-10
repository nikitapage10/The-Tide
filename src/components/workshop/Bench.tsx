/**
 * The Workshop, as a bench: the instruments the GM reads at a glance (the
 * next session, prep still open, the press's latest release), the tools on
 * the wall (prints, builds, the press, sources, settings) with the labs in a
 * drawer, the machines' queue, the activity log, and the ledger of
 * unresolved lore.
 */
import Link from "next/link";
import { PrintCard } from "@/components/live/PrintCard";
import { Reveal } from "@/components/motion/Reveal";
import { RefLink } from "@/components/records/RefLink";
import { WorldText } from "@/components/tide/WorldText";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Markdown } from "@/components/ui/Markdown";
import { EmptyState } from "@/components/ui/States";
import { listRecords, resolveRef } from "@/lib/domain/queries";
import { SECTIONS } from "@/lib/domain/sections";
import { workOrders } from "@/lib/domain/work-orders";
import type { AppContext } from "@/lib/server/context";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
const LABS = new Set(["cloud-lab", "alphabet-lab", "orbit-lab"]);

export async function Bench({ ctx }: { ctx: AppContext }) {
  const [state, releases, sessionStates, checklist, prints, builds, activity, project] = await Promise.all([
    ctx.publicationStore.getActiveState(),
    ctx.publicationStore.listReleases(),
    ctx.operationalStore.listSessionStates(),
    ctx.operationalStore.listChecklistItems(),
    ctx.operationalStore.listPrintJobs(),
    ctx.operationalStore.listBuilds(),
    ctx.operationalStore.listActivity(8),
    ctx.publicationStore.getProject(),
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
  const def = SECTIONS.find((s) => s.key === "workshop")!;
  const counts: Record<string, string> = {
    prints: `${prints.filter((p) => !["complete", "canceled"].includes(p.status)).length} open`,
    builds: `${builds.filter((b) => !["done", "abandoned"].includes(b.status)).length} active`,
    publishing: project.releaseCount ? `v${project.releaseCount}` : "no releases",
    settings: ctx.mode === "demo" ? "demo" : "connected",
    ceo: `${workOrders(state, checklist, sessionStates).length} orders`,
  };
  const tools = def.subsections.filter((s) => !LABS.has(s.slug));
  const labs = def.subsections.filter((s) => LABS.has(s.slug));
  return (
    <>
      {/* Instruments. */}
      <section aria-label="At a glance" className="mb-20 grid gap-px overflow-hidden bg-white/[0.07] lg:grid-cols-3">
        <div className="instrument bg-bg p-6">
          <h2 id="h-next" className="tracked mb-4 text-[0.6rem] text-faint">
            Next session
          </h2>
          {next ? (
            <div className="space-y-1">
              <p className="t-title">
                <RefLink r={resolveRef(state, next.sessionId)} />
              </p>
              <p className="text-sm text-muted">
                Scheduled for <time dateTime={next.scheduledFor!}>{next.scheduledFor}</time> · {next.status.replace("_", " ")}
              </p>
              {upcoming.length > 1 ? <p className="text-xs text-faint">{upcoming.length - 1} more scheduled after this.</p> : null}
            </div>
          ) : (
            <EmptyState title="No session is scheduled.">Set a date on a session page under Stories.</EmptyState>
          )}
        </div>
        <div className="instrument bg-bg p-6">
          <h2 id="h-prep" className="tracked mb-4 flex items-center justify-between text-[0.6rem] text-faint">
            <span>Open prep items</span>
            <Badge>{openItems.length} open</Badge>
          </h2>
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
        </div>
        <div className="instrument bg-bg p-6">
          <h2 id="h-release" className="tracked mb-4 text-[0.6rem] text-faint">
            The press · latest release
          </h2>
          {latest ? (
            <div className="space-y-1 text-sm">
              <p className="flex items-baseline gap-3">
                <span className="t-display-m">v{latest.version}</span> {latest.kind === "rollback" ? <Badge tone="warn">rollback</Badge> : null}
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
        </div>
      </section>

      {/* The tool wall, and the drawer of labs. */}
      <section aria-labelledby="tools-h" className="mb-20 grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <Reveal as="h2" className="t-display-m mb-6" decode="On the wall" />
          <span id="tools-h" className="sr-only">
            Tools
          </span>
          <ul className="pegboard grid gap-3 sm:grid-cols-2">
            {tools.map((s) => (
              <li key={s.slug}>
                <Link href={`/workshop/${s.slug}`} className="tool group block h-full p-5 no-underline">
                  <span className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-display)] text-xl text-text group-hover:text-white">{s.label}</span>
                    {counts[s.slug] ? <span className="font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">{counts[s.slug]}</span> : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted">{s.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Reveal as="h2" className="t-display-m mb-6" decode="The drawer" />
          <p className="mb-4 text-sm text-muted">Labs: places to try effects, the script and motion by hand.</p>
          <ul>
            {labs.map((s) => (
              <li key={s.slug}>
                <Link href={`/workshop/${s.slug}`} className="group flex items-baseline justify-between gap-3 border-t border-white/[0.08] py-3 no-underline">
                  <span className="text-text group-hover:text-white">{s.label}</span>
                  <span className="tracked text-[0.56rem] text-faint">lab</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Machines and the log. */}
      <div className="mb-20 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="h-prints">
          <h2 id="h-prints" className="tracked mb-4 flex items-center justify-between text-[0.6rem] text-faint">
            <span>Prints in progress</span>
            <Link href="/workshop/prints" className="text-faint">
              Print queue
            </Link>
          </h2>
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
        <section aria-labelledby="h-activity">
          <h2 id="h-activity" className="tracked mb-4 text-[0.6rem] text-faint">
            Recent live activity
          </h2>
          {activity.length ? (
            <ol className="log font-[family-name:var(--font-mono)] text-[0.78rem]">
              {activity.map((a) => (
                <li key={a.id} className="border-t border-white/[0.06] py-2">
                  <span className="text-text">{a.summary}</span> {a.demo ? <DemoBadge /> : null}
                  <span className="block text-[0.66rem] text-faint">
                    {fmt(a.at)} · {a.actorLabel}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No live activity yet.">Checklist, session, print and build changes appear here.</EmptyState>
          )}
        </section>
      </div>

      {/* The ledger of unresolved lore. */}
      <section aria-labelledby="open-questions-h" id="open-questions" className="mb-12 scroll-mt-32">
        <h2 id="open-questions-h" className="t-display-m mb-2">
          Unresolved lore
        </h2>
        <p className="mb-8 max-w-2xl text-sm text-muted">Recorded so they are not filled in by guesswork: contradictions between the documents and things not yet written. Settle them in the ChatGPT spaces, then publish.</p>
        {questions.length ? (
          <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
            {questions.map(({ record: q }) => (
              <li key={q.id} className="border-l border-warn/50 pl-4">
                <h3 className="t-title">
                  <WorldText text={q.title} />
                </h3>
                {q.summary ? (
                  <p className="mt-1 text-sm text-muted">
                    <WorldText text={q.summary} />
                  </p>
                ) : null}
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
    </>
  );
}
