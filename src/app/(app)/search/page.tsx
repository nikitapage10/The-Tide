import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { buildSearchDocs, search } from "@/lib/domain/search";
import { requirePageContext } from "@/lib/server/page-context";
import { one, type SearchParams } from "@/lib/server/params";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const q = one((await searchParams).q).trim();
  const ctx = await requirePageContext();
  const [state, prints, builds] = await Promise.all([ctx.publicationStore.getActiveState(), ctx.operationalStore.listPrintJobs(), ctx.operationalStore.listBuilds()]);
  const hits = q ? search(buildSearchDocs(state, prints, builds), q) : [];
  return (
    <>
      <PageHeader title="Search" description="Searches published lore, stories, The Studio, print jobs and builds. Accents and apostrophes are ignored. GM notes are not searched." />
      <form method="get" action="/search" role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="search-page-q" className="sr-only">
          Search
        </label>
        <input id="search-page-q" name="q" type="search" defaultValue={q} className="min-h-10 flex-1 rounded-md border border-border-strong bg-bg px-3" />
        <button type="submit" className="min-h-10 rounded-md bg-accent px-4 font-medium text-accent-ink">
          Search
        </button>
      </form>
      {!q ? (
        <EmptyState title="Type something to search." />
      ) : hits.length ? (
        <>
          <h2 className="mb-3 text-lg">
            {hits.length} result{hits.length === 1 ? "" : "s"} for “{q}”
          </h2>
          <ul className="space-y-2">
            {hits.map((h) => (
              <li key={h.id} className="rounded-[var(--radius)] border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={h.href} className="font-medium">
                    {h.title}
                  </Link>
                  <Badge>{h.kind.replace("_", " ")}</Badge>
                  {h.demo ? <DemoBadge /> : null}
                  {h.archived ? <Badge tone="warn">Archived</Badge> : null}
                </div>
                {h.snippet ? <p className="mt-1 line-clamp-2 text-sm text-muted">{h.snippet}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState title={`No results for “${q}”.`}>Try a shorter word, or check the spelling. Archived entries are included but ranked lower.</EmptyState>
      )}
    </>
  );
}
