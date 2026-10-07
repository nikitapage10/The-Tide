import Link from "next/link";
import { BuildDialog } from "@/components/live/BuildForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { linkOptions } from "@/lib/domain/link-options";
import { BUILD_CATEGORIES } from "@/lib/domain/types";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "Builds" };

export default async function BuildsPage() {
  const ctx = await requirePageContext();
  const [builds, state] = await Promise.all([ctx.operationalStore.listBuilds(), ctx.publicationStore.getActiveState()]);
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "The Workshop" }]}
        title="Builds"
        description="Physical creations, code, logic and dashboard work. Practical records only; no CAD or code editor."
        actions={<BuildDialog linkOptions={linkOptions(state)} triggerLabel="New build" />}
      />
      {builds.length ? (
        BUILD_CATEGORIES.filter((c) => builds.some((b) => b.category === c)).map((c) => (
          <section key={c} aria-labelledby={`cat-${c}`} className="mb-6">
            <h2 id={`cat-${c}`} className="mb-2 text-lg capitalize">
              {c}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {builds
                .filter((b) => b.category === c)
                .map((b) => (
                  <li key={b.id} className="rounded-[var(--radius)] border border-border bg-surface p-4">
                    <h3 className="text-lg">
                      <Link href={`/workshop/builds/${b.id}`} className="text-text">
                        {b.title}
                      </Link>
                    </h3>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="info">{b.status.replace("_", " ")}</Badge>
                      {b.versions.length ? <Badge>{b.versions.length} versions</Badge> : null}
                      {b.demo ? <DemoBadge /> : null}
                    </p>
                    {b.purpose ? <p className="mt-2 text-sm text-muted">{b.purpose}</p> : null}
                  </li>
                ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState title="No builds yet.">Create one to track a physical creation, code or logic.</EmptyState>
      )}
    </>
  );
}
