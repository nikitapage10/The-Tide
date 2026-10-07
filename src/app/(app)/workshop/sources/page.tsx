import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { safeHref } from "@/lib/contract/safety";
import { listRecords } from "@/lib/domain/queries";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const sources = listRecords(state, "source", { includeArchived: true });
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "The Workshop" }]}
        title="Sources"
        description="Source references published with lore. Unknown titles, revisions and hashes stay blank. The dashboard never fetches or reads these documents."
      />
      {sources.length ? (
        <ul className="space-y-3">
          {sources.map(({ record: s, state: st }) => {
            const href = safeHref(s.url);
            return (
              <li key={s.id} id={`source-${s.id}`} className="rounded-[var(--radius)] border border-border bg-surface p-4">
                <h2 className="text-lg">{s.title ?? <span className="text-muted">Untitled source (title not supplied)</span>}</h2>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>Access: {s.access}</Badge>
                  {st.lifecycle !== "active" ? <Badge tone="warn">{st.lifecycle}</Badge> : null}
                  {s.demo ? <DemoBadge /> : null}
                </p>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted">Link</dt>
                  <dd className="break-all">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                        Open source<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      "Not supplied"
                    )}
                  </dd>
                  <dt className="text-muted">Document ID</dt>
                  <dd className="break-all font-mono text-xs">{s.documentId ?? "Not supplied"}</dd>
                  <dt className="text-muted">Revision</dt>
                  <dd>{s.revision ?? "Not supplied"}</dd>
                  <dt className="text-muted">Content hash</dt>
                  <dd className="break-all font-mono text-xs">{s.contentHash ?? "Not supplied"}</dd>
                </dl>
                {s.notes ? <p className="mt-2 text-sm text-muted">{s.notes}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No sources have been published." />
      )}
    </>
  );
}
