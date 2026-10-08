import Link from "next/link";
import type { StoryRecord } from "@/lib/contract/schema";
import type { Listed } from "@/lib/domain/queries";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { RecordBadges } from "./Badges";

export const FORMAT_LABEL: Record<StoryRecord["format"], string> = {
  campaign: "Campaign",
  one_shot: "One-shot",
  novel: "Novel",
  short_fiction: "Short fiction",
};
export const CONTINUITY_LABEL = { shared_canon: "Shared canon", story_specific: "Story-specific continuity", unknown: "Continuity not stated" } as const;

export function StoryList({ stories, empty }: { stories: Listed<StoryRecord>[]; empty: string }) {
  if (!stories.length) return <EmptyState title={empty}>Stories appear after a release that includes them is published from its ChatGPT space.</EmptyState>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {stories.map(({ record: s, state }) => (
        <li key={s.id} className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="eyebrow">{FORMAT_LABEL[s.format]}</p>
          <h3 className="text-lg">
            <Link href={`/stories/${s.id}`} className="text-text">
              {s.title}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <RecordBadges demo={s.demo} canonStatus={s.canonStatus} lifecycle={state.lifecycle} />
            <Badge tone={s.continuity === "shared_canon" ? "ok" : "neutral"}>{CONTINUITY_LABEL[s.continuity]}</Badge>
            {s.draftStatus ? <Badge tone="info">Draft: {s.draftStatus.replace("_", " ")}</Badge> : null}
          </div>
          {s.summary ? <p className="mt-2 text-sm text-muted">{s.summary}</p> : null}
        </li>
      ))}
    </ul>
  );
}
