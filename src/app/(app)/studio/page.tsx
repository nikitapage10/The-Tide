import Link from "next/link";
import { StudioBrowser } from "@/components/records/StudioBrowser";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { listRecords } from "@/lib/domain/queries";
import { SECTIONS, STUDIO_TYPE_GROUPS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";
import { one, type SearchParams } from "@/lib/server/params";

export const metadata = { title: "The Studio" };

export default async function StudioPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const sp = await searchParams;
  const media = listRecords(state, "media");
  const def = SECTIONS.find((s) => s.key === "studio")!;
  return (
    <>
      <PageHeader
        eyebrow="Section"
        title={def.label}
        description="Music, artwork, artistic elements, aesthetics, branding and design. Items are external links or private asset references; stages keep inspiration, drafts, approved visual canon and final assets distinct."
      />
      <nav aria-label="Studio categories" className="mb-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(STUDIO_TYPE_GROUPS).map(([slug, g]) => (
            <li key={slug}>
              <Link href={`/studio/browse/${slug}`} className="block h-full rounded-[var(--radius)] border border-border bg-surface p-4 no-underline hover:border-border-strong">
                <span className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-display)] text-lg text-text">{g.label}</span>
                  <Badge>{media.filter((m) => g.types.includes(m.record.mediaType)).length}</Badge>
                </span>
                <span className="mt-1 block text-sm text-muted">{g.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <StudioBrowser state={state} basePath="/studio" filters={{ q: one(sp.q), type: one(sp.type), stage: one(sp.stage), tag: one(sp.tag), status: one(sp.status) }} />
    </>
  );
}
