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
              className={cx(
                "transition-tide block rounded-md px-3 py-2 text-[0.95rem] no-underline",
                active ? "bg-surface-3 font-semibold text-text" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {item.label}
            </Link>
            {active && item.children?.length ? (
              <ul className="mb-2 ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {item.children.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      aria-current={isActive(pathname, c.href) ? "page" : undefined}
                      className={cx(
                        "transition-tide block rounded px-2 py-1.5 text-sm no-underline",
                        isActive(pathname, c.href) ? "text-accent-strong" : "text-faint hover:text-text",
                      )}
                    >
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
