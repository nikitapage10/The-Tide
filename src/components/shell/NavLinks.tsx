"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

export interface NavItem {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary sections as a horizontal, tracked-uppercase bar (desktop). */
export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className="flex items-center gap-2 xl:gap-8">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : active ? "true" : undefined}
              className={cx(
                "transition-tide relative block px-3 py-2 font-[family-name:var(--font-mono)] text-[0.74rem] uppercase tracking-[0.3em] no-underline",
                active ? "text-white" : "text-[#d4d4d8] hover:text-white",
              )}
            >
              {item.label}
              <span aria-hidden="true" className={cx("absolute inset-x-3 -bottom-px h-px", active ? "bg-white" : "bg-transparent")} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sub-sections of the active section, as a tab row under the header. */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  const section = items.find((i) => i.href !== "/" && isActive(pathname, i.href));
  if (!section?.children?.length) return null;
  return (
    <nav aria-label={`${section.label} sections`} className="border-b border-border bg-bg/80">
      <ul className="mx-auto flex max-w-[96rem] gap-1 overflow-x-auto px-4 sm:px-10">
        <li>
          <Link href={section.href} aria-current={pathname === section.href ? "page" : undefined} className={tab(pathname === section.href)}>
            Overview
          </Link>
        </li>
        {section.children.map((c) => (
          <li key={c.href}>
            <Link href={c.href} aria-current={isActive(pathname, c.href) ? "page" : undefined} className={tab(isActive(pathname, c.href))}>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const tab = (active: boolean) =>
  cx(
    "tracked transition-tide block whitespace-nowrap border-b px-3 py-3 text-[0.68rem] no-underline",
    active ? "border-white text-white" : "border-transparent text-faint hover:text-white",
  );

/** Stacked list for the mobile menu. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cx("tracked block px-1 py-2.5 no-underline", active ? "text-white" : "text-muted hover:text-white")}
            >
              {item.label}
            </Link>
            {active && item.children?.length ? (
              <ul className="mb-2 ml-1 space-y-0.5 border-l border-border pl-3">
                {item.children.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className={cx("block py-1.5 text-sm no-underline", isActive(pathname, c.href) ? "text-white" : "text-faint hover:text-white")}>
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
