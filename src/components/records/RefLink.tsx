import Link from "next/link";
import type { ResolvedRef } from "@/lib/domain/queries";
import { DemoBadge } from "@/components/ui/Badge";
import { Redacted } from "@/components/tide/Redacted";
import { LifecycleBadge } from "./Badges";

/** Link to a stable ID that stays meaningful when the target is archived, removed or unknown. */
export function RefLink({ r, showType = false }: { r: ResolvedRef; showType?: boolean }) {
  const label = (
    <>
      <Redacted text={r.title} />
      {showType && r.type ? <span className="ml-1 text-xs text-faint">({r.type.replace("_", " ")})</span> : null}
    </>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {r.href && r.status !== "tombstoned" && r.status !== "missing" ? <Link href={r.href}>{label}</Link> : <span className="text-muted">{label}</span>}
      {r.demo ? <DemoBadge /> : null}
      <LifecycleBadge lifecycle={r.status} />
    </span>
  );
}

export function RefList({ refs, empty, showType }: { refs: ResolvedRef[]; empty: string; showType?: boolean }) {
  if (!refs.length) return <p className="text-sm text-faint">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {refs.map((r) => (
        <li key={r.id}>
          <RefLink r={r} showType={showType} />
        </li>
      ))}
    </ul>
  );
}
