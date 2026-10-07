import type { CanonStatus, Visibility } from "@/lib/contract/schema";
import type { Lifecycle } from "@/lib/domain/types";
import { Badge, DemoBadge } from "@/components/ui/Badge";

const CANON: Record<CanonStatus, { label: string; tone: "ok" | "info" | "warn" | "neutral"; title: string }> = {
  confirmed: { label: "Confirmed", tone: "ok", title: "Confirmed in supplied source material" },
  provisional: { label: "Provisional", tone: "info", title: "Structural or inferred; not yet confirmed by a source" },
  unverified: { label: "Unverified", tone: "warn", title: "Unresolved or needs a source decision" },
  non_canon: { label: "Not canon", tone: "neutral", title: "Not part of canon" },
};

export function CanonBadge({ status }: { status: CanonStatus }) {
  const c = CANON[status];
  return (
    <Badge tone={c.tone} title={c.title}>
      {c.label}
    </Badge>
  );
}

export function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle | "missing" }) {
  if (lifecycle === "active") return null;
  if (lifecycle === "archived") return <Badge tone="warn" title="Archived in the active release; identity and live links are kept">Archived</Badge>;
  if (lifecycle === "tombstoned") return <Badge tone="danger" title="Removed; identity retired">Removed</Badge>;
  return <Badge tone="danger" title="This ID is not in the active release">Unavailable</Badge>;
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return visibility === "player_safe" ? (
    <Badge tone="info" title="Eligible for a future player view. This does not make it public.">Player-safe candidate</Badge>
  ) : (
    <Badge title="Visible to GMs only">GM only</Badge>
  );
}

export function RecordBadges({ demo, canonStatus, lifecycle, visibility }: { demo: boolean; canonStatus?: CanonStatus; lifecycle?: Lifecycle; visibility?: Visibility }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {demo ? <DemoBadge /> : null}
      {canonStatus && !demo ? <CanonBadge status={canonStatus} /> : null}
      {lifecycle ? <LifecycleBadge lifecycle={lifecycle} /> : null}
      {visibility ? <VisibilityBadge visibility={visibility} /> : null}
    </span>
  );
}
