/**
 * The library shelf: every story as a spine, standing on one line. Novels
 * are tall, campaigns broad (voyage logs), one-shots slim, short fiction a
 * chapbook. The spine's title runs vertically; hovering draws it out a
 * little. A plain list follows for reading and for screen readers.
 */
import Link from "next/link";
import type { StoryRecord } from "@/lib/contract/schema";
import { renameWorld } from "@/lib/domain/world-name";

const SHAPE: Record<StoryRecord["format"], { h: number; w: number; label: string }> = {
  novel: { h: 15.5, w: 3.4, label: "Novel" },
  campaign: { h: 13, w: 4.6, label: "Campaign log" },
  one_shot: { h: 11, w: 2.4, label: "One-shot" },
  short_fiction: { h: 9.5, w: 2.1, label: "Short fiction" },
};

export function Shelf({ stories }: { stories: StoryRecord[] }) {
  return (
    <div className="shelf -mx-1 overflow-x-auto px-1 pb-2">
      <ul className="flex min-w-max items-end gap-2 border-b border-white/25 pb-0" aria-label="The shelf">
        {stories.map((s, i) => {
          const shape = SHAPE[s.format];
          return (
            <li key={s.id}>
              <Link
                href={`/stories/${s.id}`}
                className="spine group relative flex flex-col items-center justify-between no-underline"
                data-format={s.format}
                style={{ height: `${shape.h + ((i * 7) % 3) * 0.5}rem`, width: `${shape.w}rem` }}
                aria-label={`${renameWorld(s.title)}, ${shape.label.toLowerCase()}`}
              >
                <span aria-hidden="true" className="spine-band mt-3 h-px w-3/5" />
                <span aria-hidden="true" className="spine-title">
                  {renameWorld(s.title)}
                </span>
                <span aria-hidden="true" className="spine-band mb-3 h-px w-3/5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { SHAPE as SPINE_SHAPE };
