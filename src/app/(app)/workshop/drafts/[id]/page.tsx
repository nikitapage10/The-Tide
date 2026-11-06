import { notFound } from "next/navigation";
import { requireGmPageContext } from "@/lib/server/page-context";
import { PageHeader } from "@/components/shell/PageHeader";
import { DraftEditor, DraftDiscussion } from "@/components/codex/DraftEditor";
import { Markdown } from "@/components/ui/Markdown";
import {
  draftSubject,
  draftVersions,
  draftComments,
  workingDrafts,
} from "@/lib/domain/drafts";
export const metadata = { title: "Working draft" };
export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    ctx = await requireGmPageContext(),
    state = await ctx.publicationStore.getActiveState();
  const notes = await ctx.operationalStore.listGmNotes(draftSubject(state)),
    history = draftVersions(notes).filter((v) => v.record.id === id),
    record = workingDrafts(state, notes).find((r) => r.id === id);
  if (!record) notFound();
  const parents = new Set(history.map((v) => v.parentVersionId));
  const versionId =
    history.find((v) => !parents.has(v.versionId))?.versionId ?? null;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop/drafts", label: "Working drafts" }]}
        title={record.title}
        description="Private authoring, kept separately from published lore."
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <DraftEditor key={versionId} record={record} versionId={versionId} />
        <aside>
          <h2 className="t-display-m mb-5">Development notes</h2>
          <DraftDiscussion id={id} notes={draftComments(notes, id)} />
          <h2 className="t-display-m mb-5 mt-10">Revision history</h2>
          <p className="mb-4 text-xs text-muted">
            Copy text from a previous revision into the editor to restore it as
            a new save.
          </p>
          {history.map((h, i) => (
            <details key={h.versionId} className="border-t border-border py-3">
              <summary className="cursor-pointer text-sm">
                Revision {history.length - i} ·{" "}
                {new Date(h.createdAt).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
              </summary>
              <div className="reading mt-4 text-sm">
                <h3>{h.record.title}</h3>
                <Markdown>{h.record.body ?? ""}</Markdown>
              </div>
            </details>
          ))}
        </aside>
      </div>
    </>
  );
}
