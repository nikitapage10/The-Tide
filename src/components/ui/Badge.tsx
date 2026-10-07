import { cx } from "./cx";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "demo" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-border-strong text-muted",
  accent: "border-accent/60 text-accent-strong",
  ok: "border-ok/60 text-ok",
  warn: "border-warn/60 text-warn",
  danger: "border-danger/60 text-danger",
  demo: "border-demo/70 text-demo",
  info: "border-accent-2/60 text-accent-2",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap", tones[tone], className)}
    >
      {children}
    </span>
  );
}

/** Visible demo label. Every demo record shows this. */
export function DemoBadge() {
  return (
    <Badge tone="demo" title="Demonstration record — not canon">
      Demo
    </Badge>
  );
}
