import { notFound } from "next/navigation";
import { GroupView } from "@/components/browse/GroupView";
import { STORY_FORMAT_GROUPS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  if (!STORY_FORMAT_GROUPS[group]) notFound();
  const ctx = await requirePageContext();
  return <GroupView state={await ctx.publicationStore.getActiveState()} section="stories" group={group} />;
}
