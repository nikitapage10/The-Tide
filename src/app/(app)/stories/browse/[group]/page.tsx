import { notFound } from "next/navigation";
import { StoryList } from "@/components/records/StoryList";
import { PageHeader } from "@/components/shell/PageHeader";
import { listRecords } from "@/lib/domain/queries";
import { STORY_FORMAT_GROUPS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const g = STORY_FORMAT_GROUPS[(await params).group];
  if (!g) notFound();
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const stories = listRecords(state, "story", { includeArchived: true }).filter((s) => g.formats.includes(s.record.format));
  return (
    <>
      <PageHeader crumbs={[{ href: "/stories", label: "Stories" }]} title={g.label} description={g.description} />
      <StoryList stories={stories} empty={`No ${g.label.toLowerCase()} have been published yet.`} />
    </>
  );
}
