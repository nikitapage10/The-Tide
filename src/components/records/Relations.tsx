import type { RelationView } from "@/lib/domain/queries";
import { DemoBadge } from "@/components/ui/Badge";
import { CanonBadge } from "./Badges";
import { RefLink } from "./RefLink";

/** Accessible relationship list (both directions). Grouped by label. */
export function Relations({ relations }: { relations: RelationView[] }) {
  if (!relations.length) return <p className="text-sm text-faint">No relationships have been published for this entry.</p>;
  const groups = new Map<string, RelationView[]>();
  relations.forEach((r) => groups.set(r.label, [...(groups.get(r.label) ?? []), r]));
  return (
    <dl className="space-y-3">
      {[...groups.entries()].map(([label, items]) => (
        <div key={label}>
          <dt className="text-sm font-medium text-muted">{label}</dt>
          <dd>
            <ul className="mt-1 space-y-1.5">
              {items.map((r) => (
                <li key={r.relationshipId} className="flex flex-wrap items-center gap-1.5">
                  <RefLink r={r.other} />
                  {r.demo ? <DemoBadge /> : <CanonBadge status={r.canonStatus} />}
                  {r.note ? <span className="w-full text-xs text-faint">{r.note}</span> : null}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
