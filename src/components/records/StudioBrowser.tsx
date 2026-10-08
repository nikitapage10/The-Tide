import Link from "next/link";
import type { MediaRecord } from "@/lib/contract/schema";
import { MEDIA_STAGES, MEDIA_TYPES } from "@/lib/contract/schema";
import { allTags, listRecords } from "@/lib/domain/queries";
import { matchesQuery } from "@/lib/domain/search";
import type { PublishedState } from "@/lib/domain/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { ProceduralMark } from "@/components/ui/ProceduralMark";
import { EmptyState } from "@/components/ui/States";
import { RecordBadges } from "./Badges";

export const MEDIA_TYPE_LABEL: Record<MediaRecord["mediaType"], string> = {
  music: "Music",
  artwork: "Artwork",
  artistic_element: "Artistic element",
  aesthetic: "Aesthetic",
  branding: "Branding",
  design: "Design",
  document: "Document",
  other: "Other",
};
export const STAGE_LABEL: Record<MediaRecord["stage"], string> = {
  inspiration: "Inspiration",
  draft: "Draft",
  approved: "Approved visual canon",
  final: "Final asset",
};
export const stageTone = (s: MediaRecord["stage"]) => (s === "approved" ? "ok" : s === "final" ? "accent" : s === "draft" ? "info" : "neutral");

export function StudioBrowser({ state, types, filters, basePath }: { state: PublishedState; types?: MediaRecord["mediaType"][]; filters: Record<string, string>; basePath: string }) {
  const all = listRecords(state, "media", { includeArchived: true }).filter((m) => !types || types.includes(m.record.mediaType));
  const tags = allTags(all);
  const status = filters.status || "active";
  const results = all.filter(({ record: m, state: s }) => {
    if (status !== "all" && s.lifecycle !== status) return false;
    if (filters.type && m.mediaType !== filters.type) return false;
    if (filters.stage && m.stage !== filters.stage) return false;
    if (filters.tag && !(m.tags ?? []).includes(filters.tag)) return false;
    return matchesQuery([m.title, m.summary, ...(m.tags ?? []), m.attribution?.creator], filters.q ?? "");
  });
  return (
    <section aria-labelledby="studio-results">
      <form method="get" action={basePath} className="mb-5 grid gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="s-q" className="mb-1 block text-sm font-medium">
            Filter by text
          </label>
          <input id="s-q" name="q" type="search" defaultValue={filters.q} className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 min-h-10" />
        </div>
        {!types || types.length > 1 ? (
          <div>
            <label htmlFor="s-type" className="mb-1 block text-sm font-medium">
              Type
            </label>
            <Select id="s-type" name="type" defaultValue={filters.type}>
              <option value="">All</option>
              {(types ?? MEDIA_TYPES).map((t) => (
                <option key={t} value={t}>
                  {MEDIA_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div>
          <label htmlFor="s-stage" className="mb-1 block text-sm font-medium">
            Stage
          </label>
          <Select id="s-stage" name="stage" defaultValue={filters.stage}>
            <option value="">Any</option>
            {MEDIA_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="s-tag" className="mb-1 block text-sm font-medium">
            Tag
          </label>
          <Select id="s-tag" name="tag" defaultValue={filters.tag}>
            <option value="">Any</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <input type="hidden" name="status" value={status} />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="primary">
            Apply filters
          </Button>
          <Link href={basePath} className="px-2 py-2 text-sm">
            Clear
          </Link>
        </div>
      </form>
      <h2 id="studio-results" className="mb-3 text-lg">
        {results.length} {results.length === 1 ? "item" : "items"}
      </h2>
      {results.length === 0 ? (
        <EmptyState title={all.length ? "No items match these filters." : "Nothing has been published here yet."}>Studio items are published from the ChatGPT spaces as links or private asset references.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map(({ record: m, state: s }) => (
            <li key={m.id} className="flex gap-3 rounded-[var(--radius)] border border-border bg-surface p-4">
              <ProceduralMark seed={m.id} size={44} className="shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="eyebrow">{MEDIA_TYPE_LABEL[m.mediaType]}</p>
                <h3 className="text-lg leading-snug">
                  <Link href={`/studio/item/${m.id}`} className="text-text">
                    {m.title}
                  </Link>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={stageTone(m.stage)}>{STAGE_LABEL[m.stage]}</Badge>
                  <RecordBadges demo={m.demo} lifecycle={s.lifecycle} />
                  {m.asset ? <Badge>Private asset</Badge> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
