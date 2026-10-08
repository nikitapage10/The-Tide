import { PeopleGallery } from "@/components/people/PeopleGallery";
import { SectionOverview } from "@/components/records/EntityPages";
import { requirePageContext } from "@/lib/server/page-context";
import type { SearchParams } from "@/lib/server/params";

export const metadata = { title: "People" };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePageContext();
  // Filtering (?q=, ?tag=, ...) shows the index; otherwise the gallery.
  if (Object.keys(await searchParams).length) return <SectionOverview ctx={ctx} section="people" searchParams={searchParams} />;
  return <PeopleGallery state={await ctx.publicationStore.getActiveState()} />;
}
