import Link from "next/link";
import { HomeHero, type HeroCallout, type HeroObservation } from "@/components/home/HomeHero";

/**
 * Rotating notes on the hero. Names come from the GM's own documents ("The Tide -
 * Intro", "Tide 101"); the lines are kept deliberately vague (the GM prefers the
 * lore unresolved). Positions are on the artwork (percent).
 * "Storm cell" describes the animated weather, not lore.
 */
/** The four marked spots on the planet: the cursor's strands rise from them and
 * the rotating notes appear there (percent of the artwork). */
const SPOTS = { a: { x: 68, y: 28 }, b: { x: 78, y: 42 }, c: { x: 70, y: 60 }, d: { x: 84, y: 76 } };

/**
 * Rotating notes, in four slots that run at once (two on the planet, two out in
 * space), so with the one fixed callout there are always three to five on
 * screen. Each slot keeps to its own spots, so notes never land on each other.
 * Each note has a small effect at its point, matched to what it names.
 */
const OBSERVATIONS: HeroObservation[][] = [
  [
    { ...SPOTS.c, side: "right", title: "Storm cell", line: "Atmosphere unstable", fx: "lightning" },
    { ...SPOTS.a, side: "right", title: "The Drowning", line: "Shorelines that no longer hold", fx: "ripple" },
    { ...SPOTS.c, side: "right", title: "The Undertow", line: "Before the Veil", fx: "sink" },
    { ...SPOTS.a, side: "right", title: "Age of the Veil", line: "Records scarce", fx: "veil" },
    { ...SPOTS.c, side: "right", title: "Dark coast", line: "Lights failing", fx: "flicker" },
    { ...SPOTS.a, side: "right", title: "Survey", line: "Incomplete", fx: "grid" },
  ],
  [
    { ...SPOTS.b, side: "right", title: "The Divergence", line: "Something woke", fx: "split" },
    { ...SPOTS.d, side: "left", title: "The Drift", line: "Arrivals from elsewhere", fx: "drift" },
    { ...SPOTS.b, side: "right", title: "Era of Verdancy", line: "Present, for now", fx: "bloom" },
    { ...SPOTS.d, side: "left", title: "Entry unknown", line: "Designation withheld", fx: "brackets" },
    { ...SPOTS.b, side: "right", title: "Pressure front", line: "Building slowly", fx: "isobars" },
    { ...SPOTS.d, side: "left", title: "Tide line", line: "Rising", fx: "tideline" },
  ],
];

/** Notes out in space: they describe what is visible there, not lore. */
const SPACE_NOTES: HeroObservation[][] = [
  [
    { x: 30, y: 57, side: "right", title: "Gravitic stream", line: "Flowing in · flowing out", fx: "stream" },
    { x: 24, y: 64, side: "right", title: "Debris field", line: "Drifting, slowly", fx: "orbit" },
    { x: 33, y: 61, side: "right", title: "Cold spot", line: "Below background", fx: "cold" },
    { x: 27, y: 54, side: "right", title: "Echo", line: "Returning late", fx: "echo" },
  ],
  [
    { x: 54, y: 19, side: "left", title: "Light bending", line: "Source unknown", fx: "glint" },
    { x: 53, y: 25, side: "left", title: "Signal", line: "Faint · repeating", fx: "wave" },
    { x: 57, y: 22, side: "left", title: "Lensing arc", line: "Steady", fx: "arc" },
    { x: 52, y: 17, side: "left", title: "Sweep", line: "No return", fx: "scan" },
  ],
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
  // The one fixed callout; it points at a real published entry.
  const callouts: HeroCallout[] = [
    { x: 46, y: 47, side: "right", title: "The Tide", lines: ["Origin unresolved"], href: href("The Tide (in-lore usage)"), code: code("The Tide (in-lore usage)") },
  ];

  return (
    <>
      <HomeHero callouts={callouts} observations={OBSERVATIONS} spots={Object.values(SPOTS)} spaceNotes={SPACE_NOTES} code={latest ? `Archive · release v${latest.version}` : "Archive · no release yet"} />
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
