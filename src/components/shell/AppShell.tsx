import Link from "next/link";
import { SECTIONS } from "@/lib/domain/sections";
import { NavLinks, type NavItem } from "./NavLinks";

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  ...SECTIONS.map((s) => ({
    href: s.href,
    label: s.label,
    children: s.subsections.map((sub) => ({
      href: s.key === "workshop" ? `/workshop/${sub.slug}` : `${s.href}/browse/${sub.slug}`,
      label: sub.label,
    })),
  })),
];

function SearchForm({ id }: { id: string }) {
  return (
    <form action="/search" method="get" role="search" className="w-full">
      <label htmlFor={id} className="sr-only">
        Search The Tide
      </label>
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Search entries, stories, studio, prints…"
        autoComplete="off"
        className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-base text-text placeholder:text-faint min-h-10"
      />
    </form>
  );
}

export function AppShell({ mode, actorLabel, children }: { mode: "demo" | "supabase"; actorLabel: string; children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      {mode === "demo" ? (
        <div className="border-b border-demo/40 bg-demo/10 px-4 py-1.5 text-center text-sm text-demo">
          Local demo mode · data is stored in a file on this machine, not in a production database ·{" "}
          <Link href="/workshop/settings" className="text-demo underline">
            details & reset
          </Link>
        </div>
      ) : null}
      <header className="contour-bg sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3">
          <Link href="/" className="shrink-0 no-underline">
            <span className="font-[family-name:var(--font-display)] text-xl text-text">The Tide</span>
            <span className="eyebrow ml-2 hidden sm:inline">archive</span>
          </Link>
          <div className="ml-auto hidden w-full max-w-md md:block">
            <SearchForm id="global-search" />
          </div>
          <span className="hidden text-xs text-faint lg:inline" title="Signed in as">
            {actorLabel}
          </span>
          {mode === "supabase" ? (
            <form action="/auth/signout" method="post" className="hidden md:block">
              <button type="submit" className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-text">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <div className="mx-auto flex max-w-[90rem] gap-6 px-4">
        <nav aria-label="Primary" className="sticky top-[4.25rem] hidden h-[calc(100vh-4.5rem)] w-60 shrink-0 overflow-y-auto py-6 md:block">
          <NavLinks items={NAV} />
        </nav>
        <div className="min-w-0 flex-1">
          {/* Mobile navigation: native disclosure, works without JavaScript. */}
          <details className="mt-3 rounded-md border border-border bg-surface md:hidden">
            <summary className="cursor-pointer px-3 py-2.5 font-medium">Menu & search</summary>
            <div className="space-y-3 border-t border-border p-3">
              <SearchForm id="mobile-search" />
              <nav aria-label="Primary (mobile)">
                <NavLinks items={NAV} />
              </nav>
              {mode === "supabase" ? (
                <form action="/auth/signout" method="post">
                  <button type="submit" className="text-sm text-muted underline">
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </details>
          <main id="main" tabIndex={-1} className="py-6 focus:outline-none sm:py-8">
            {children}
          </main>
          <footer className="border-t border-border py-6 text-xs text-faint">
            Authored lore lives in Space Pages. This dashboard shows published releases only and never edits them.
          </footer>
        </div>
      </div>
    </>
  );
}
