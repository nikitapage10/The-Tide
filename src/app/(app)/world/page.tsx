import { SectionOverview } from "@/components/records/EntityPages";
import { WorldOverview } from "@/components/world/WorldOverview";
import { requirePageContext } from "@/lib/server/page-context";
import type { SearchParams } from "@/lib/server/params";

export const metadata = { title: "The World" };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePageContext();
  // Filtering (?q=, ?tag=, ...) shows the index; otherwise the atlas.
  if (Object.keys(await searchParams).length) return <SectionOverview ctx={ctx} section="world" searchParams={searchParams} />;
  return <WorldOverview state={await ctx.publicationStore.getActiveState()} />;
}
