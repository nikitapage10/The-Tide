import Link from "next/link";
import { SECTIONS } from "@/lib/domain/sections";
import { EditAccessProvider } from "./EditAccess";
import { NavLinks, SubNav, TopNav, type NavItem } from "./NavLinks";

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  ...SECTIONS.map((s) => ({
    href: s.href,
    label: s.navLabel,
    children: s.subsections.map((sub) => ({
      href: s.key === "workshop" ? `/workshop/${sub.slug}` : `${s.href}/browse/${sub.slug}`,
      label: sub.label,
    })),
  })),
];

/** The mark: a ring cut by a vertical meridian. */
function Mark() {
  return (
    <svg aria-hidden="true" width="34" height="60" viewBox="0 0 34 60" className="shrink-0">
      <circle cx="17" cy="30" r="13" fill="none" stroke="currentColor" strokeWidth="0.9" />
      <line x1="17" y1="0" x2="17" y2="60" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  );
}

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
        placeholder="Search the archive"
        autoComplete="off"
        className="tracked min-h-10 w-full border-0 border-b border-border-strong bg-transparent px-1 py-2 text-[0.7rem] text-text placeholder:text-faint focus:border-white"
      />
    </form>
  );
}

export function AppShell({ mode, actorLabel, canEdit, children }: { mode: "demo" | "supabase"; actorLabel: string; canEdit: boolean; children: React.ReactNode }) {
  return (
    <EditAccessProvider canEdit={canEdit}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:bg-white focus:px-3 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-md [text-shadow:0_1px_8px_rgba(0,0,0,.9)]">
        <div className="page-x flex h-[var(--header-h)] items-center gap-4">
          <Link href="/" className="flex items-center gap-3 text-white no-underline">
            <Mark />
            <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-lg uppercase tracking-[0.3em] sm:text-xl sm:tracking-[0.4em]">The Tide</span>
          </Link>
          <span aria-hidden="true" className="mx-4 hidden h-9 w-px bg-white/20 lg:block" />
          <nav aria-label="Primary" className="hidden lg:block">
            <TopNav items={NAV.slice(1)} />
          </nav>
          <Link href="/search" aria-label="Search the archive" title="Search" className="ml-auto hidden h-4 w-4 rounded-full border border-white/70 hover:border-white lg:block" />
          {mode === "supabase" && !canEdit ? (
            <Link href="/login" className="tracked hidden px-2 py-1 text-[0.65rem] text-muted no-underline hover:text-white lg:block">
              Sign in
            </Link>
          ) : null}
          {mode === "supabase" && canEdit ? (
            <form action="/auth/signout" method="post" className="hidden lg:block">
              <button type="submit" className="tracked px-2 py-1 text-[0.65rem] text-muted hover:text-white" title={`Signed in as ${actorLabel}`}>
                Sign out
              </button>
            </form>
          ) : null}
          {/* Mobile and tablet menu: native disclosure, works without JavaScript. */}
          <details className="group relative ml-auto lg:hidden">
            <summary className="tracked cursor-pointer list-none border border-white/25 px-3 py-2 text-[0.68rem] text-white whitespace-nowrap">Menu</summary>
            <div className="fixed inset-x-0 top-[var(--header-h)] max-h-[calc(100svh-var(--header-h))] space-y-4 overflow-y-auto border-b border-white/10 bg-bg px-4 py-5 sm:px-10">
              <SearchForm id="mobile-search" />
              <nav aria-label="Primary (mobile)">
                <NavLinks items={NAV} />
              </nav>
              {mode === "supabase" && !canEdit ? <Link href="/login" className="tracked text-[0.68rem]">Sign in</Link> : null}
              {mode === "supabase" && canEdit ? (
                <form action="/auth/signout" method="post">
                  <button type="submit" className="tracked text-[0.68rem] text-muted underline">
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </details>
        </div>
      </header>
      <SubNav items={NAV} />
      <div>
        <main id="main" tabIndex={-1} className="page-x py-8 focus:outline-none sm:py-10">
          {children}
        </main>
        <footer className="tracked page-mx flex flex-wrap justify-between gap-2 border-t border-white/10 py-6 text-[0.62rem] text-faint">
          <span>Authored lore lives in Space Pages. This dashboard shows published releases only.</span>
          <span>{mode === "demo" ? "Local demo · not production data" : canEdit ? `Signed in · ${actorLabel}` : "Public view · read-only"}</span>
        </footer>
      </div>
    </EditAccessProvider>
  );
}
