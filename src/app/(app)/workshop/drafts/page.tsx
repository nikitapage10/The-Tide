import Link from "next/link";
import { requireGmPageContext } from "@/lib/server/page-context";
import { PageHeader } from "@/components/shell/PageHeader";
import { draftSubject, workingDrafts } from "@/lib/domain/drafts";
import { EmptyState } from "@/components/ui/States";
export const metadata = { title: "Working drafts" };
export default async function DraftsPage() {
  const ctx = await requireGmPageContext();
  const state = await ctx.publicationStore.getActiveState();
  const notes = await ctx.operationalStore.listGmNotes(draftSubject(state));
  const drafts = workingDrafts(state, notes);
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "Workshop" }]}
        title="Working drafts"
        description="Develop a region, a character, a question, or a story. Drafts remain private and unverified."
        actions={<Link href="/workshop/drafts/new">New draft →</Link>}
      />
      {drafts.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {drafts.map((s) => (
            <li key={s.id} className="border border-border bg-surface p-6">
              <h2 className="t-display-m">
                <Link href={"/workshop/drafts/" + s.id}>{s.title}</Link>
              </h2>
              <p className="mt-3 text-sm text-muted">{s.summary}</p>
              <p className="tracked mt-4 text-[0.6rem] text-faint">
                Private draft · revisions retained
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="A place for the next idea.">
          Create a draft to begin. Its changes will be kept in release history.
        </EmptyState>
      )}
    </>
  );
}
