import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { CanonMark } from "@/components/tide/CanonMark";
import { Redacted } from "@/components/tide/Redacted";
import { SectionIntro } from "@/components/tide/SectionIntro";
import { Shelf } from "@/components/stories/Shelf";
import { EmptyState } from "@/components/ui/States";
import { listRecords } from "@/lib/domain/queries";
import { STORY_FORMAT_GROUPS } from "@/lib/domain/sections";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "Stories" };

/** Stories, as a library: the shelf, then the reading list by form. */
export default async function StoriesPage() {
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  // Canon first, then the rest, each in title order.
  const stories = listRecords(state, "story").sort((a, b) => Number(a.record.demo) - Number(b.record.demo));
  return (
    <div data-section="stories">
      <SectionIntro
        index="03"
        eyebrow="Stories"
        title="The Library"
        lede={
          <>
            Waves crash upon shores,
            <br />
            As the Tide&rsquo;s eternal song,
            <br />
            Echoes through the void.
          </>
        }
      />
      {stories.length ? (
        <>
          <section aria-labelledby="shelf-h" className="mb-20">
            <h2 id="shelf-h" className="sr-only">
              The shelf
            </h2>
            <Shelf stories={stories.map((s) => s.record)} />
          </section>
          <section aria-labelledby="list-h" className="mb-16">
            <Reveal as="h2" className="t-display-m mb-10" decode="The reading list" />
            <span id="list-h" className="sr-only">
              The reading list
            </span>
            <div className="grid gap-14 lg:grid-cols-2">
              {Object.entries(STORY_FORMAT_GROUPS).map(([slug, g]) => {
                const items = stories.filter((s) => g.formats.includes(s.record.format));
                return (
                  <div key={slug}>
                    <p className="tracked mb-4 flex items-center justify-between text-[0.62rem] text-faint">
                      <Link href={`/stories/browse/${slug}`} className="text-faint no-underline hover:text-white">
                        {g.label}
                      </Link>
                      <span>{items.length}</span>
                    </p>
                    {items.length ? (
                      <ol>
                        {items.map(({ record: s }) => (
                          <li key={s.id}>
                            <Link href={`/stories/${s.id}`} className="group block border-t border-white/[0.08] py-4 no-underline">
                              <span className="toc-row">
                                <span className="t-title text-text group-hover:text-white">
                                  <Redacted text={s.title} />
                                </span>
                                <span aria-hidden="true" className="toc-fill" />
                                <span className="font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">{s.demo ? "demo" : (s.draftStatus ?? "").replace("_", " ")}</span>
                              </span>
                              {s.summary ? (
                                <span className="mt-1 block font-[family-name:var(--font-display)] text-[1.02rem] italic text-muted">
                                  <Redacted text={s.summary} />
                                </span>
                              ) : null}
                              <CanonMark status={s.canonStatus} className="mt-2" />
                            </Link>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="border-t border-white/[0.08] pt-4 text-sm text-faint">Nothing on this shelf yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <EmptyState title="No stories have been published yet.">Stories appear after a release that includes them is published from its ChatGPT space.</EmptyState>
      )}
    </div>
  );
}
