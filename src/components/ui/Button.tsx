import Link from "next/link";
import { forwardRef } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const base =
  "transition-tide inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium min-h-10 disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong",
  secondary: "border border-border-strong bg-surface-2 text-text hover:bg-surface-3",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "border border-danger/70 text-danger hover:bg-danger/10",
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(function Button(
  { variant = "secondary", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cx(base, variants[variant], className)} {...props} />;
});

export function ButtonLink({ href, variant = "secondary", className, children }: { href: string; variant?: Variant; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx(base, variants[variant], "no-underline", className)}>
      {children}
    </Link>
  );
}
