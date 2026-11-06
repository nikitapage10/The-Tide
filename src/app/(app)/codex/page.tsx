import Link from "next/link";
import { requirePageContext } from "@/lib/server/page-context";
import { listRecords, hrefFor } from "@/lib/domain/queries";
import { matchesQuery } from "@/lib/domain/search";
import { ENTITY_KIND_LABEL } from "@/lib/domain/sections";
import { imageFor, isEnclave } from "@/lib/domain/views";
import { PageHeader } from "@/components/shell/PageHeader";
import { Plate } from "@/components/tide/Plate";
import { CanonMark } from "@/components/tide/CanonMark";
import { EmptyState } from "@/components/ui/States";
import { one, type SearchParams } from "@/lib/server/params";
export const metadata = { title: "Codex" };
const VIEWS = [
  { id: "peoples", label: "Peoples" },
  { id: "places", label: "Places" },
  { id: "history", label: "History & forces" },
  { id: "all", label: "All entries" },
];
export default async function CodexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.id === one(sp.view))
      ? one(sp.view)
      : "peoples",
    q = one(sp.q),
    kind = one(sp.kind);
  const all = listRecords(state, "entity").filter((e) => !e.record.demo);
  const subset = all.filter(({ record: r }) =>
    view === "peoples"
      ? r.kind === "people" && !isEnclave(r)
      : view === "places"
        ? ["place", "environment"].includes(r.kind)
        : view === "history"
          ? ["history", "event", "phenomenon", "world_mechanic"].includes(
              r.kind,
            )
          : true,
  );
  const entries = subset.filter(
    ({ record: r }) =>
      (!kind || r.kind === kind) &&
      matchesQuery(
        [r.title, r.summary, r.body, ...(r.aliases ?? []), ...(r.tags ?? [])],
        q,
      ),
  );
  const kinds = [...new Set(subset.map((e) => e.record.kind))];
  return (
    <>
      <PageHeader
        eyebrow="The living archive"
        title="The Codex"
        description="One place to rediscover Ilyr’s peoples, places, histories, and forces."
      />
      {ctx.canEdit && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-white/15 py-5">
          <div>
            <p className="tracked text-[0.65rem] text-faint">
              OUR CURRENT FOCUS
            </p>
            <p className="t-title mt-1">Two years after the upheaval</p>
            <p className="mt-2 text-sm text-muted">
              Develop one starting region and the first storyline. Keep
              unresolved source accounts visible.
            </p>
          </div>
          <Link href="/workshop/planning" className="text-sm">
            Open the planning desk →
          </Link>
        </div>
      )}
      <nav aria-label="Codex views" className="mb-6 flex flex-wrap gap-3">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={"/codex?view=" + v.id}
            aria-current={view === v.id ? "page" : undefined}
            className={
              "border-b px-2 py-3 text-sm no-underline " +
              (view === v.id
                ? "border-white text-white"
                : "border-transparent text-muted hover:text-white")
            }
          >
            {v.label}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        action="/codex"
        className="mb-7 flex flex-wrap items-end gap-4"
      >
        <input type="hidden" name="view" value={view} />
        <div className="min-w-48 flex-1">
          <label htmlFor="codex-q" className="mb-2 block text-xs text-muted">
            Search this collection
          </label>
          <input
            id="codex-q"
            name="q"
            defaultValue={q}
            type="search"
            placeholder="A name, place, ability, or phrase…"
            className="min-h-11 w-full border border-border-strong bg-surface px-3 py-2 text-sm"
          />
        </div>
        {kinds.length > 1 && (
          <div>
            <label
              htmlFor="codex-kind"
              className="mb-2 block text-xs text-muted"
            >
              Category
            </label>
            <select
              id="codex-kind"
              name="kind"
              defaultValue={kind}
              className="min-h-11 border border-border-strong bg-surface px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {ENTITY_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          className="min-h-11 border border-white/30 px-5 py-2 text-sm"
          type="submit"
        >
          Search
        </button>
        {(q || kind) && (
          <Link href={"/codex?view=" + view} className="py-3 text-sm">
            Clear
          </Link>
        )}
      </form>
      <p className="mb-6 text-xs text-faint">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
        {ctx.canEdit
          ? " · Full source text and development notes are available to you."
          : " · Reader introductions; detailed histories stay in the GM’s archive."}
      </p>
      {entries.length ? (
        <ul className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(({ record: r, state: rs }) => (
            <li key={r.id}>
              <Link
                href={hrefFor(rs) ?? "/codex"}
                className="group block h-full border-t border-white/15 pt-4 no-underline"
              >
                {view === "peoples" && (
                  <Plate
                    src={imageFor(state, r.id)}
                    alt={r.title}
                    seed={r.id}
                    ratio="4 / 3"
                    sizes="(min-width: 1024px) 28vw, 90vw"
                    palette={r.palette}
                  />
                )}
                <div className="mt-4">
                  <span className="tracked text-[0.58rem] text-faint">
                    {ENTITY_KIND_LABEL[r.kind]}
                  </span>
                  <h2 className="t-display-m mt-2 text-text group-hover:text-white">
                    {r.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {r.summary}
                  </p>
                  <CanonMark
                    status={r.canonStatus}
                    showLabel
                    className="mt-4"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No matching entries.">
          Try a different phrase or clear the category filter.
        </EmptyState>
      )}
    </>
  );
}
