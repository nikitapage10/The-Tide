import type { SourceRef } from "@/lib/contract/schema";
import type { PublishedState } from "@/lib/domain/types";
import { safeHref } from "@/lib/contract/safety";

/** Source references with honest gaps: unknown metadata stays visibly unknown. */
export function SourceRefs({ refs, state }: { refs: SourceRef[] | undefined; state: PublishedState }) {
  if (!refs?.length) return <p className="text-sm text-faint">No source reference has been supplied for this entry.</p>;
  return (
    <ul className="space-y-2">
      {refs.map((ref, i) => {
        const src = state.records[ref.sourceId]?.record;
        if (!src || src.type !== "source") return <li key={i} className="text-sm text-muted">Source {ref.sourceId} is unavailable.</li>;
        const href = safeHref(src.url);
        return (
          <li key={i} className="text-sm">
            <span className="font-medium">{src.title ?? "Untitled source (title not supplied)"}</span>
            {ref.locator ? <span className="text-muted"> · {ref.locator}</span> : null}
            {href ? (
              <>
                {" "}
                <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                  Open source<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
            <span className="block text-xs text-faint">
              Revision: {src.revision ?? "not supplied"} · Content hash: {src.contentHash ?? "not supplied"} · Access: {src.access}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
