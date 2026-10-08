import Link from "next/link";
import { ENTITY_KIND_LABEL, PEOPLE_KIND_GROUPS, WORLD_KIND_GROUPS, sectionForEntityKind } from "@/lib/domain/sections";
import { allTags, listRecords } from "@/lib/domain/queries";
import { matchesQuery } from "@/lib/domain/search";
import type { PublishedState } from "@/lib/domain/types";
import type { EntityKind } from "@/lib/contract/schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { ProceduralMark } from "@/components/ui/ProceduralMark";
import { EmptyState } from "@/components/ui/States";
import { RecordBadges } from "./Badges";

export interface BrowserFilters {
  q: string;
  kind: string;
  tag: string;
  status: string;
  canon: string;
}

export function EntityBrowser({
  state,
  section,
  groupKey,
  filters,
  basePath,
}: {
  state: PublishedState;
  section: "world" | "people";
  groupKey?: string;
  filters: BrowserFilters;
  basePath: string;
}) {
  const groups = section === "people" ? PEOPLE_KIND_GROUPS : WORLD_KIND_GROUPS;
  const groupKinds: EntityKind[] = groupKey ? (groups[groupKey]?.kinds ?? []) : Object.values(groups).flatMap((g) => g.kinds);
  const inSection = listRecords(state, "entity", { includeArchived: true }).filter(
    (e) => sectionForEntityKind(e.record.kind) === section && groupKinds.includes(e.record.kind),
  );
  const tags = allTags(inSection);
  const status = filters.status || "active";
  const results = inSection.filter((e) => {
    const r = e.record;
    if (status !== "all" && e.state.lifecycle !== status) return false;
    if (filters.kind && r.kind !== filters.kind) return false;
    if (filters.tag && !(r.tags ?? []).includes(filters.tag)) return false;
    if (filters.canon === "demo" ? !r.demo : filters.canon ? r.demo || r.canonStatus !== filters.canon : false) return false;
    return matchesQuery([r.title, r.summary, r.body, ...(r.aliases ?? []), ...(r.tags ?? [])], filters.q);
  });
  const filtered = Boolean(filters.q || filters.kind || filters.tag || filters.canon || status !== "active");

  return (
    <section aria-labelledby="browse-heading">
      <form method="get" action={basePath} className="mb-5 grid gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="f-q" className="mb-1 block text-sm font-medium">
            Filter by text
          </label>
          <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder="Name, alias, tag…" className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 min-h-10" />
        </div>
        {groupKinds.length > 1 ? (
          <div>
            <label htmlFor="f-kind" className="mb-1 block text-sm font-medium">
              Category
            </label>
            <Select id="f-kind" name="kind" defaultValue={filters.kind}>
              <option value="">All</option>
              {groupKinds.map((k) => (
                <option key={k} value={k}>
                  {ENTITY_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div>
          <label htmlFor="f-tag" className="mb-1 block text-sm font-medium">
            Tag
          </label>
          <Select id="f-tag" name="tag" defaultValue={filters.tag}>
            <option value="">Any</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="f-canon" className="mb-1 block text-sm font-medium">
            Canon status
          </label>
          <Select id="f-canon" name="canon" defaultValue={filters.canon}>
            <option value="">Any</option>
            <option value="confirmed">Confirmed</option>
            <option value="provisional">Provisional</option>
            <option value="unverified">Unverified</option>
            <option value="demo">Demo only</option>
          </Select>
        </div>
        <div>
          <label htmlFor="f-status" className="mb-1 block text-sm font-medium">
            Publication
          </label>
          <Select id="f-status" name="status" defaultValue={status}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" variant="primary">
            Apply filters
          </Button>
          {filtered ? (
            <Link href={basePath} className="px-2 py-2 text-sm">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <h2 id="browse-heading" className="mb-3 text-lg">
        {results.length} {results.length === 1 ? "entry" : "entries"}
        {filtered ? <span className="text-faint"> matching filters</span> : null}
      </h2>

      {results.length === 0 ? (
        <EmptyState title={inSection.length ? "No entries match these filters." : "Nothing has been published here yet."}>
          {inSection.length
            ? "Try clearing a filter. Names are matched without accents or apostrophes, so “Teruanga” finds “Teruānga”."
            : "Entries appear after a release that includes them is published from its ChatGPT space."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map(({ record: r, state: s }) => (
            <li key={r.id} className="flex gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 hover:border-border-strong">
              <ProceduralMark seed={r.id} size={44} className="shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="eyebrow">{ENTITY_KIND_LABEL[r.kind]}</p>
                <h3 className="text-lg leading-snug">
                  <Link href={`/${section}/entry/${r.id}`} className="text-text no-underline hover:underline">
                    {r.title}
                  </Link>
                </h3>
                <RecordBadges demo={r.demo} canonStatus={r.canonStatus} lifecycle={s.lifecycle} />
                {r.summary ? <p className="line-clamp-3 text-sm text-muted">{r.summary}</p> : null}
                {r.tags?.length ? (
                  <p className="flex flex-wrap gap-1 pt-1">
                    {r.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
