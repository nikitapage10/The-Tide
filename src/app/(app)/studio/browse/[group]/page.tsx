import { notFound } from "next/navigation";
import { GroupView } from "@/components/browse/GroupView";
import { StudioBrowser } from "@/components/records/StudioBrowser";
import { PageHeader } from "@/components/shell/PageHeader";
import { STUDIO_TYPE_GROUPS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";
import { one, type SearchParams } from "@/lib/server/params";

export default async function Page({ params, searchParams }: { params: Promise<{ group: string }>; searchParams: SearchParams }) {
  const { group } = await params;
  const g = STUDIO_TYPE_GROUPS[group];
  if (!g) notFound();
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const sp = await searchParams;
  if (!Object.keys(sp).length) return <GroupView state={state} section="studio" group={group} />;
  return (
    <>
      <PageHeader crumbs={[{ href: "/studio", label: "The Studio" }]} title={g.label} description={g.description} />
      <StudioBrowser state={state} types={g.types} basePath={`/studio/browse/${group}`} filters={{ q: one(sp.q), type: one(sp.type), stage: one(sp.stage), tag: one(sp.tag), status: one(sp.status) }} />
    </>
  );
}
