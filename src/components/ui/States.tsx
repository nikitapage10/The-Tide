import { cx } from "./cx";

export function EmptyState({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[var(--radius)] border border-dashed border-border-strong p-5 text-muted", className)}>
      <p className="font-medium text-text">{title}</p>
      {children ? <div className="mt-1 text-sm">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger" | "ok"; title?: string; children: React.ReactNode }) {
  const tones = {
    info: "border-accent-2/50 bg-accent-2/5",
    warn: "border-warn/60 bg-warn/5",
    danger: "border-danger/60 bg-danger/5",
    ok: "border-ok/60 bg-ok/5",
  };
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cx("rounded-md border p-3 text-sm", tones[tone])}>
      {title ? <p className="font-semibold text-text">{title}</p> : null}
      <div className="text-muted">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("rounded-md bg-surface-2", className)} />;
}

export function LoadingPage({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
