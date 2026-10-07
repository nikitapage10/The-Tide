import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Markdown } from "@/components/ui/Markdown";
import { ProceduralMark } from "@/components/ui/ProceduralMark";
import { Notice } from "@/components/ui/States";
import { PageHeader } from "@/components/shell/PageHeader";
import { GmNotesPanel } from "@/components/live/GmNotesPanel";
import { ENTITY_KIND_LABEL, PEOPLE_KIND_GROUPS, SECTIONS, WORLD_KIND_GROUPS, sectionForEntityKind } from "@/lib/domain/sections";
import { backlinksFor, childrenOf, listRecords, mediaFor, relationsFor, resolveRef } from "@/lib/domain/queries";
import type { AppContext } from "@/lib/server/context";
import { one, type SearchParams } from "@/lib/server/params";
import { RecordBadges } from "./Badges";
import { Chronology } from "./Chronology";
import { EntityBrowser } from "./EntityBrowser";
import { RefLink, RefList } from "./RefLink";
import { Relations } from "./Relations";
import { SourceRefs } from "./Sources";

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

  const [prints, builds, notes] = await Promise.all([
    ctx.operationalStore.listPrintJobs(),
    ctx.operationalStore.listBuilds(),
    ctx.operationalStore.listGmNotes(id),
  ]);
  const relations = relationsFor(state, id);
  const backlinks = backlinksFor(state, id);
  const media = mediaFor(state, id);
  const children = childrenOf(state, id);
  const groupSlug = Object.entries(groupsFor(section)).find(([, g]) => g.kinds.includes(r.kind))?.[0];
  const linkedPrints = prints.filter((p) => p.linkedRecordIds.includes(id));
  const linkedBuilds = builds.filter((b) => b.linkedRecordIds.includes(id));
  const openConflicts = (r.conflicts ?? []).filter((c) => c.status === "open");

  return (
    <article aria-labelledby="entry-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <ProceduralMark seed={r.id} size={88} />
          <p className="mt-1 w-[88px] text-[0.7rem] leading-tight text-faint">Placeholder pattern, not canonical art</p>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap gap-1 text-sm text-faint">
              <li>
                <Link href={def.href} className="text-faint">
                  {def.label}
                </Link>
              </li>
              {groupSlug ? (
                <li>
                  <span aria-hidden="true">/ </span>
                  <Link href={`/${section}/browse/${groupSlug}`} className="text-faint">
                    {groupsFor(section)[groupSlug]!.label}
                  </Link>
                </li>
              ) : null}
            </ol>
          </nav>
          <p className="eyebrow">{ENTITY_KIND_LABEL[r.kind]}</p>
          <h1 id="entry-title" className="text-3xl sm:text-4xl">
            {r.title}
          </h1>
          <RecordBadges demo={r.demo} canonStatus={r.canonStatus} lifecycle={rs.lifecycle} visibility={r.visibility} />
          {r.aliases?.length ? <p className="text-sm text-muted">Also recorded as: {r.aliases.join(" · ")}</p> : null}
          {r.summary ? <p className="max-w-3xl text-lg text-muted">{r.summary}</p> : null}
          {r.tags?.length ? (
            <p className="flex flex-wrap gap-1">
              {r.tags.map((t) => (
                <Link key={t} href={`/${section}?tag=${encodeURIComponent(t)}`} className="no-underline">
                  <Badge>{t}</Badge>
                </Link>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      {rs.lifecycle === "archived" ? (
        <div className="mb-4">
          <Notice tone="warn" title="Archived">
            This entry is archived in the active release. It stays readable here, and live work linked to it is kept.
          </Notice>
        </div>
      ) : null}
      {r.demo ? (
        <div className="mb-4">
          <Notice title="Demonstration record">This record exists to show how the interface works. It is not canon.</Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card as="section" aria-labelledby="h-body">
            <SectionHeading id="h-body">Published entry</SectionHeading>
            {r.body ? <Markdown>{r.body}</Markdown> : <p className="text-muted">Source material has not been supplied.</p>}
            <p className="mt-4 text-xs text-faint">Read-only. To change this entry, edit it in Space Pages and publish a new release.</p>
          </Card>
          {r.chronology ? <Chronology chronology={r.chronology} /> : null}
          {openConflicts.length ? (
            <Card as="section" aria-labelledby="h-conflicts" className="border-warn/50">
              <SectionHeading id="h-conflicts">Unresolved source questions</SectionHeading>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {openConflicts.map((c, i) => (
                  <li key={i}>{c.description}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {r.parentId || children.length ? (
            <Card as="section" aria-labelledby="h-nesting">
              <SectionHeading id="h-nesting">Within the world</SectionHeading>
              {r.parentId ? (
                <p className="mb-2 text-sm">
                  Part of: <RefLink r={resolveRef(state, r.parentId)} />
                </p>
              ) : null}
              {children.length ? <RefList refs={children.map((c) => resolveRef(state, c.record.id))} empty="" /> : null}
            </Card>
          ) : null}
          <Card as="section" aria-labelledby="h-rel">
            <SectionHeading id="h-rel">Relationships</SectionHeading>
            <Relations relations={relations} />
          </Card>
          <Card as="section" aria-labelledby="h-appears">
            <SectionHeading id="h-appears">Appears in</SectionHeading>
            <RefList refs={backlinks} empty="No stories, sessions or other entries reference this yet." showType />
          </Card>
        </div>
        <aside className="space-y-5" aria-label="Related material">
          <Card as="section" aria-labelledby="h-studio">
            <SectionHeading id="h-studio">From The Studio</SectionHeading>
            <RefList refs={media.map((m) => resolveRef(state, m.record.id))} empty="No music, art or design is linked." />
          </Card>
          <Card as="section" aria-labelledby="h-workshop">
            <SectionHeading id="h-workshop">In The Workshop</SectionHeading>
            {linkedPrints.length || linkedBuilds.length ? (
              <ul className="space-y-1.5 text-sm">
                {linkedPrints.map((p) => (
                  <li key={p.id}>
                    <Link href={`/workshop/prints/${p.id}`}>{p.title}</Link> <span className="text-faint">· print, {p.status.replace("_", "-")}</span>
                  </li>
                ))}
                {linkedBuilds.map((b) => (
                  <li key={b.id}>
                    <Link href={`/workshop/builds/${b.id}`}>{b.title}</Link> <span className="text-faint">· build, {b.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">No print jobs or builds are linked.</p>
            )}
          </Card>
          <Card as="section" aria-labelledby="h-sources">
            <SectionHeading id="h-sources">Sources</SectionHeading>
            <SourceRefs refs={r.sourceRefs} state={state} />
          </Card>
          <Card as="section" aria-labelledby="h-notes">
            <SectionHeading id="h-notes">GM notes</SectionHeading>
            <GmNotesPanel subjectId={r.id} notes={notes} />
          </Card>
        </aside>
      </div>
    </article>
  );
}
