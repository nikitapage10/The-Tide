import { TideMark } from "./TideMark";

/** Minimal frame for pages shown before access is established (no project data). */
export function Plain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12">
      <TideMark height={48} className="mb-5 text-white/85" />
      <p className="eyebrow">The Tide</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
      <div className="mt-4 space-y-4 text-muted">{children}</div>
    </main>
  );
}
