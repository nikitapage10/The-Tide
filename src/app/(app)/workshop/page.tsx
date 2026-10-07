import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { SECTIONS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "The Workshop" };

export default async function WorkshopPage() {
  const ctx = await requirePageContext();
  const [prints, builds, project] = await Promise.all([ctx.operationalStore.listPrintJobs(), ctx.operationalStore.listBuilds(), ctx.publicationStore.getProject()]);
  const def = SECTIONS.find((s) => s.key === "workshop")!;
  const counts: Record<string, string> = {
    prints: `${prints.filter((p) => !["complete", "canceled"].includes(p.status)).length} open`,
    builds: `${builds.filter((b) => !["done", "abandoned"].includes(b.status)).length} active`,
    publishing: project.releaseCount ? `v${project.releaseCount}` : "no releases",
    sources: "",
    settings: ctx.mode === "demo" ? "demo" : "connected",
  };
  return (
    <>
      <PageHeader eyebrow="Section" title={def.label} description="Physical creations and building, the 3D print queue, code, logic and the dashboard itself, including publishing. Artistic concepts live in The Studio." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {def.subsections.map((s) => (
          <li key={s.slug}>
            <Link href={`/workshop/${s.slug}`} className="block h-full rounded-[var(--radius)] border border-border bg-surface p-5 no-underline hover:border-border-strong">
              <span className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-display)] text-xl text-text">{s.label}</span>
                {counts[s.slug] ? <Badge>{counts[s.slug]}</Badge> : null}
              </span>
              <span className="mt-1 block text-sm text-muted">{s.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
