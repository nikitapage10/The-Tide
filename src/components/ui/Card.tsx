import { cx } from "./cx";

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: React.ReactNode; as?: "div" | "section" | "article" | "li" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx("rounded-[var(--radius)] border border-border bg-surface p-4 sm:p-5", className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionHeading({ id, children, action }: { id?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-xl">
        {children}
      </h2>
      {action}
    </div>
  );
}
