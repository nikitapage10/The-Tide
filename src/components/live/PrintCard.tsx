import Link from "next/link";
import type { PrintJob } from "@/lib/domain/types";
import { Badge, DemoBadge } from "@/components/ui/Badge";

export const PRINT_TONE: Record<PrintJob["status"], "neutral" | "info" | "accent" | "ok" | "warn" | "danger"> = {
  planned: "neutral",
  ready: "info",
  printing: "accent",
  post_processing: "info",
  complete: "ok",
  blocked: "danger",
  canceled: "neutral",
};

export function PrintProgress({ job }: { job: PrintJob }) {
  const pct = Math.round((job.completedQuantity / job.requestedQuantity) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted">
        <span>
          {job.completedQuantity} of {job.requestedQuantity} complete
        </span>
        {job.failedQuantity ? <span className="text-warn">{job.failedQuantity} failed</span> : null}
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={job.requestedQuantity} aria-valuenow={job.completedQuantity} aria-label={`${job.title} progress`}>
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PrintCard({ job }: { job: PrintJob }) {
  return (
    <li className="space-y-2 rounded-[var(--radius)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg leading-snug">
          <Link href={`/workshop/prints/${job.id}`} className="text-text">
            {job.title}
          </Link>
        </h3>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={PRINT_TONE[job.status]}>{job.status.replace("_", "-")}</Badge>
          {job.priority !== "normal" ? <Badge tone={job.priority === "urgent" || job.priority === "high" ? "warn" : "neutral"}>{job.priority} priority</Badge> : null}
          {job.demo ? <DemoBadge /> : null}
        </span>
      </div>
      <PrintProgress job={job} />
    </li>
  );
}
