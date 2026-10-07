import Link from "next/link";
import { StoryList } from "@/components/records/StoryList";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/Card";
import { listRecords } from "@/lib/domain/queries";
import { SECTIONS, STORY_FORMAT_GROUPS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "Stories" };

export default async function StoriesPage() {
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const stories = listRecords(state, "story");
  const def = SECTIONS.find((s) => s.key === "stories")!;
  return (
    <>
      <PageHeader eyebrow="Section" title={def.label} description="The stories of the world's people, plus play preparation and session records. Narrative is authored in Space Pages; live prep and session state are kept here." />
      <nav aria-label="Story formats" className="mb-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(STORY_FORMAT_GROUPS).map(([slug, g]) => (
            <li key={slug}>
              <Link href={`/stories/browse/${slug}`} className="block h-full rounded-[var(--radius)] border border-border bg-surface p-4 no-underline hover:border-border-strong">
                <span className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-display)] text-lg text-text">{g.label}</span>
                  <Badge>{stories.filter((s) => g.formats.includes(s.record.format)).length}</Badge>
                </span>
                <span className="mt-1 block text-sm text-muted">{g.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SectionHeading>All stories</SectionHeading>
      <StoryList stories={stories} empty="No stories have been published yet." />
    </>
  );
}
