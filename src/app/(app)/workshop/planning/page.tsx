import Link from "next/link";
import { draftSubject, workingDrafts } from "@/lib/domain/drafts";
import { requireGmPageContext } from "@/lib/server/page-context";
import { PageHeader } from "@/components/shell/PageHeader";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { listRecords } from "@/lib/domain/queries";
import { Markdown } from "@/components/ui/Markdown";
export const metadata = { title: "Two Years After" };
export default async function PlanningPage() {
  const ctx = await requireGmPageContext();
  const state = await ctx.publicationStore.getActiveState();
  const entities = listRecords(state, "entity");
  const premise = entities.find((e) =>
    e.record.tags?.includes("working premise"),
  );
  const privateNotes = await ctx.operationalStore.listGmNotes(
    draftSubject(state),
  );
  const drafts = workingDrafts(state, privateNotes);
  const questions = listRecords(state, "open_question").filter(
    (q) => q.record.status === "open",
  );
  const notes = premise
    ? await ctx.operationalStore.listGmNotes(premise.record.id)
    : [];
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "Workshop" }]}
        title="Two Years After"
        description="Our shared present. One starting region. The first storyline."
      />
      {premise && (
        <section className="mb-10 border-y border-white/15 py-7">
          <h2 className="t-display-m mb-4">The working premise</h2>
          <div className="reading max-w-3xl">
            <Markdown>
              {premise.record.body ?? premise.record.summary ?? ""}
            </Markdown>
          </div>
        </section>
      )}
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        {drafts.map((s) => (
          <Link
            href={"/workshop/drafts/" + s.id}
            key={s.id}
            className="block border border-border bg-surface p-6 no-underline"
          >
            <p className="tracked text-[0.6rem] text-faint">
              Private working draft
            </p>
            <h2 className="t-display-m mt-3">{s.title}</h2>
            <p className="mt-3 text-sm text-muted">{s.summary}</p>
            <span className="mt-5 block text-sm">Open the editor →</span>
          </Link>
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="t-display-m mb-5">Decisions to make</h2>
          <ul className="space-y-5">
            {questions.map(({ record: q }) => (
              <li key={q.id} className="border-l border-white/20 pl-4">
                <h3 className="t-title">{q.title}</h3>
                <p className="mt-2 text-sm text-muted">{q.summary}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="t-display-m mb-5">Notes on the shared present</h2>
          {premise ? (
            <GmNotesPanel subjectId={premise.record.id} notes={notes} />
          ) : (
            <p className="text-sm text-muted">
              The complete-source lore release has not been published yet. The
              working premise will appear here after publication.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
