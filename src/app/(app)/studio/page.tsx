import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { MEDIA_TYPE_LABEL } from "@/components/records/StudioBrowser";
import { SectionIntro } from "@/components/tide/SectionIntro";
import { Plate } from "@/components/tide/Plate";
import { WorldText } from "@/components/tide/WorldText";
import { ThemePlayer } from "@/components/studio/ThemePlayer";
import { StudioBrowser } from "@/components/records/StudioBrowser";
import { MEDIA_STAGES, type MediaRecord } from "@/lib/contract/schema";
import { listRecords } from "@/lib/domain/queries";
import { STUDIO_TYPE_GROUPS } from "@/lib/domain/sections";
import { isImageUrl, peoples } from "@/lib/domain/views";
import { requirePageContext } from "@/lib/server/page-context";
import { one, type SearchParams } from "@/lib/server/params";

export const metadata = { title: "The Studio" };

const STAGE: Record<MediaRecord["stage"], { label: string; note: string }> = {
  inspiration: { label: "Inspiration", note: "loose, pinned up" },
  draft: { label: "Draft", note: "being worked" },
  approved: { label: "Approved", note: "visual canon" },
  final: { label: "Final", note: "framed" },
};

/** The Studio, as a light table: work pinned up by stage, a listening corner, the palette and the type. */
export default async function StudioPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePageContext();
  const state = await ctx.publicationStore.getActiveState();
  const sp = await searchParams;
  if (Object.keys(sp).length) {
    return (
      <div data-section="studio">
        <SectionIntro index="04" eyebrow="Studio" title="The Studio" size="m" />
        <StudioBrowser state={state} basePath="/studio" filters={{ q: one(sp.q), type: one(sp.type), stage: one(sp.stage), tag: one(sp.tag), status: one(sp.status) }} />
      </div>
    );
  }
  const media = listRecords(state, "media");
  const music = media.filter((m) => m.record.mediaType === "music");
  const board = media.filter((m) => m.record.mediaType !== "music");
  const palettes = peoples(state).filter((p) => p.record.palette);
  return (
    <div data-section="studio">
      <SectionIntro index="04" eyebrow="Studio" title="The Studio" lede="Where the world gets its look and its sound: work pinned up from first sketch to framed final." />

      {/* The light table. */}
      <section aria-labelledby="table-h" className="mb-24">
        <Reveal as="h2" className="t-display-m mb-8" decode="The light table" />
        <span id="table-h" className="sr-only">
          The light table
        </span>
        <div className="light-table grid gap-px overflow-hidden bg-white/[0.06] md:grid-cols-2 xl:grid-cols-4">
          {MEDIA_STAGES.map((stage) => {
            const items = board.filter((m) => m.record.stage === stage);
            return (
              <div key={stage} className="bg-[#0a0a0c] p-5" data-stage={stage}>
                <p className="tracked mb-5 flex flex-wrap items-baseline justify-between gap-x-3 text-[0.6rem] text-faint">
                  <span>{STAGE[stage].label}</span>
                  <span className="text-faint">{STAGE[stage].note}</span>
                </p>
                {items.length ? (
                  <ul className="space-y-6">
                    {items.map(({ record: m }, i) => (
                      <li key={m.id} className="pinned" style={stage === "inspiration" ? { rotate: `${((i * 37) % 7) - 3}deg` } : undefined}>
                        <Plate
                          src={m.url && isImageUrl(m.url) ? m.url : null}
                          alt={m.title}
                          seed={m.id}
                          ratio={m.role === "portrait" ? "3 / 4" : "4 / 3"}
                          href={`/studio/item/${m.id}`}
                          sizes="20rem"
                          caption={
                            <>
                              <span className="block text-sm text-text">
                                <WorldText text={m.title} />
                              </span>
                              <span className="tracked text-[0.56rem] text-faint">
                                {MEDIA_TYPE_LABEL[m.mediaType]}
                                {m.demo ? " · demo" : ""}
                              </span>
                            </>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-faint">Nothing here yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* The listening corner. */}
      <section aria-labelledby="listen-h" className="mb-24 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Reveal as="h2" className="t-display-m mb-8" decode="The listening corner" />
          <span id="listen-h" className="sr-only">
            The listening corner
          </span>
          <ThemePlayer src="/audio/tide-theme.mp3" title="The Tide, theme" />
        </div>
        <div className="lg:pt-16">
          <p className="tracked mb-3 text-[0.6rem] text-faint">Tracks and playlists</p>
          {music.length ? (
            <ul>
              {music.map(({ record: m }) => (
                <li key={m.id}>
                  <Link href={`/studio/item/${m.id}`} className="block border-t border-white/[0.07] py-3 text-text no-underline hover:text-white">
                    <WorldText text={m.title} />
                    {m.demo ? <span className="ml-2 text-xs text-faint">demo</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">No other music is published yet.</p>
          )}
        </div>
      </section>

      {/* The palette and the type. */}
      <section aria-labelledby="palette-h" className="mb-24">
        <Reveal as="h2" className="t-display-m mb-8" decode="Palette and type" />
        <span id="palette-h" className="sr-only">
          Palette and type
        </span>
        <div className="grid gap-12 lg:grid-cols-2">
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            {[
              { name: "Space", hex: "#050506" },
              { name: "Starlight", hex: "#ececee" },
              { name: "Silver", hex: "#dfe5ec" },
              ...palettes.map((p) => ({ name: p.record.title, hex: p.record.palette! })),
            ].map((c) => (
              <li key={c.name}>
                <span aria-hidden="true" className="block aspect-square w-full border border-white/10" style={{ background: c.hex }} />
                <span className="mt-2 block text-xs text-text">{c.name}</span>
                <span className="block font-[family-name:var(--font-mono)] text-[0.6rem] text-faint">{c.hex}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-8">
            <div>
              <p className="tracked mb-2 text-[0.6rem] text-faint">Display · Cormorant Garamond</p>
              <p className="t-display-l">Echoes through the void</p>
            </div>
            <div>
              <p className="tracked mb-2 text-[0.6rem] text-faint">Labels · IBM Plex Mono</p>
              <p className="tracked text-sm text-white">Origin unresolved · Arrivals from elsewhere</p>
            </div>
            <div>
              <p className="tracked mb-2 text-[0.6rem] text-faint">The script</p>
              <p className="text-sm text-muted">
                Each letter is a pair of glyphs. See the <Link href="/workshop/alphabet-lab">Alphabet lab</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="sindex-h" className="mb-12 border-t border-white/10 pt-10">
        <h2 id="sindex-h" className="tracked mb-6 text-[0.65rem] text-faint">
          The index
        </h2>
        <ul className="grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(STUDIO_TYPE_GROUPS).map(([slug, g]) => (
            <li key={slug}>
              <Link href={`/studio/browse/${slug}`} className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] py-3 no-underline hover:border-white/30">
                <span className="font-[family-name:var(--font-display)] text-lg text-text">{g.label}</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-faint">{media.filter((m) => g.types.includes(m.record.mediaType)).length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
