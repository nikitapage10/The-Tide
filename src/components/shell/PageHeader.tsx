import Link from "next/link";
import { Decode } from "@/components/glyphs/Decode";

export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
  actions,
  badges,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  return (
    <div className="mb-6 space-y-2">
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-faint">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                <Link href={c.href} className="text-faint hover:text-text">
                  {c.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Page titles arrive in the Tide's script and translate into English. */}
        <h1 className="text-3xl sm:text-4xl">
          <Decode text={title} active delay={120} />
        </h1>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {badges ? <div>{badges}</div> : null}
      {description ? <div className="max-w-3xl text-muted">{description}</div> : null}
    </div>
  );
}
