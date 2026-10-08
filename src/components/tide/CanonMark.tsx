/**
 * Honest uncertainty, drawn: a short rule whose stroke says how settled a
 * thing is: solid when confirmed, dashed when provisional, dotted when
 * unverified, broken when not canon. With a quiet label for screen readers
 * and on hover.
 */
import type { CanonStatus } from "@/lib/contract/schema";

const LABEL: Record<CanonStatus, string> = {
  confirmed: "Confirmed",
  provisional: "Provisional",
  unverified: "Unverified",
  non_canon: "Not canon",
};

export function CanonMark({ status, showLabel = false, className = "" }: { status: CanonStatus; showLabel?: boolean; className?: string }) {
  return (
    <span className={`canon-mark inline-flex items-center gap-2 ${className}`} data-canon={status} title={LABEL[status]}>
      <span aria-hidden="true" className="canon-rule" />
      <span className={showLabel ? "tracked text-[0.6rem] text-faint" : "sr-only"}>{LABEL[status]}</span>
    </span>
  );
}
