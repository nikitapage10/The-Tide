import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/States";
import { PageHeader } from "@/components/shell/PageHeader";
import { PEOPLE_KIND_GROUPS, SECTIONS, WORLD_KIND_GROUPS, sectionForEntityKind } from "@/lib/domain/sections";
import { listRecords } from "@/lib/domain/queries";
import type { AppContext } from "@/lib/server/context";
import { one, type SearchParams } from "@/lib/server/params";
import { RecordBadges } from "./Badges";
import { GroupView, hasGroupView } from "@/components/browse/GroupView";
import { EntityBrowser } from "./EntityBrowser";
import { EntryFolio } from "./EntryFolio";

type Section = "world" | "people";
const groupsFor = (s: Section) => (s === "people" ? PEOPLE_KIND_GROUPS : WORLD_KIND_GROUPS);
const sectionDef = (s: Section) => SECTIONS.find((x) => x.key === s)!;

async function filtersFrom(searchParams: SearchParams) {
  const sp = await searchParams;
  return { q: one(sp.q), kind: one(sp.kind), tag: one(sp.tag), status: one(sp.status), canon: one(sp.canon) };
}

export async function SectionOverview({ ctx, section, searchParams }: { ctx: AppContext; section: Section; searchParams: SearchParams }) {
  const state = await ctx.publicationStore.getActiveState();
  const def = sectionDef(section);
  const groups = groupsFor(section);
  const entities = listRecords(state, "entity");
  return (
    <>
      <PageHeader eyebrow="Section" title={def.label} description={def.tagline} />
      <nav aria-label={`${def.label} subsections`} className="mb-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(groups).map(([slug, g]) => {
            const count = entities.filter((e) => g.kinds.includes(e.record.kind)).length;
            return (
              <li key={slug}>
                <Link href={`/${section}/browse/${slug}`} className="block h-full rounded-[var(--radius)] border border-border bg-surface p-4 no-underline hover:border-border-strong">
                  <span className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-display)] text-lg text-text">{g.label}</span>
                    <Badge>{count}</Badge>
                  </span>
                  <span className="mt-1 block text-sm text-muted">{g.description}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <EntityBrowser state={state} section={section} filters={await filtersFrom(searchParams)} basePath={`/${section}`} />
    </>
  );
}

export async function BrowsePage({ ctx, section, group, searchParams }: { ctx: AppContext; section: Section; group: string; searchParams: SearchParams }) {
  const g = groupsFor(section)[group];
  if (!g) notFound();
  const state = await ctx.publicationStore.getActiveState();
  // Each group is its own room; filtering shows the plain list.
  if (!Object.keys(await searchParams).length && hasGroupView(section, group)) return <GroupView state={state} section={section} group={group} />;
  const def = sectionDef(section);
  return (
    <>
      <PageHeader crumbs={[{ href: def.href, label: def.label }]} title={g.label} description={g.description} />
      <EntityBrowser state={state} section={section} groupKey={group} filters={await filtersFrom(searchParams)} basePath={`/${section}/browse/${group}`} />
    </>
  );
}

export async function EntryPage({ ctx, section, id }: { ctx: AppContext; section: Section; id: string }) {
  const state = await ctx.publicationStore.getActiveState();
  const rs = state.records[id];
  const def = sectionDef(section);
  if (!rs) notFound();
  if (rs.lifecycle === "tombstoned" || !rs.record) {
    return (
      <>
        <PageHeader crumbs={[{ href: def.href, label: def.label }]} title={rs.tombstone?.lastTitle ?? "Removed entry"} badges={<RecordBadges demo={false} lifecycle="tombstoned" />} />
        <Notice tone="warn" title="This entry was removed from published lore">
          Its identity is kept so existing links and live work still resolve. Reason given: {rs.tombstone?.reason ?? "not supplied"}.
        </Notice>
      </>
    );
  }
  const r = rs.record;
  if (r.type !== "entity") notFound();
  const correct = sectionForEntityKind(r.kind);
  if (correct !== section) redirect(`/${correct}/entry/${id}`);

  return <EntryFolio ctx={ctx} state={state} rs={rs} section={section} />;
}
