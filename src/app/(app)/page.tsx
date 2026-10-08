import { HomeHero, type HeroCallout, type HeroObservation } from "@/components/home/HomeHero";

/**
 * Rotating notes on the hero. Names come from the GM's own documents ("The Tide -
 * Intro", "Tide 101"); the lines are kept deliberately vague (the GM prefers the
 * lore unresolved). Positions are on the artwork (percent).
 * "Storm cell" describes the animated weather, not lore.
 */
/** The four marked spots on the planet: the cursor's strands rise from them and
 * the rotating notes appear there (percent of the artwork). */
const SPOTS = { a: { x: 68, y: 28 }, b: { x: 78, y: 42 }, c: { x: 70, y: 60 }, d: { x: 84, y: 76 } };

/**
 * Rotating notes, in three slots that run at once (two on the planet, one out
 * in space), so with the one fixed callout there are three or four on screen. Each slot keeps to its own spots, so notes never land on each other.
 * Each note has a small effect at its point, matched to what it names. Planet
 * notes sit to the left of their spots (toward open space), clear of the edge.
 */
const OBSERVATIONS: HeroObservation[][] = [
  [
    { ...SPOTS.c, side: "left", title: "Storm cell", line: "Atmosphere unstable", fx: "lightning" },
    { ...SPOTS.a, side: "left", title: "The Drowning", line: "Shorelines that no longer hold", fx: "ripple" },
    { ...SPOTS.c, side: "left", title: "The Undertow", line: "Before the Veil", fx: "sink" },
    { ...SPOTS.a, side: "left", title: "Age of the Veil", line: "Records scarce", fx: "veil" },
    { ...SPOTS.c, side: "left", title: "Dark coast", line: "Lights failing", fx: "flicker" },
    { ...SPOTS.a, side: "left", title: "Survey", line: "Incomplete", fx: "grid" },
  ],
  [
    { ...SPOTS.b, side: "left", title: "The Divergence", line: "Something woke", fx: "split" },
    { ...SPOTS.d, side: "left", title: "The Drift", line: "Arrivals from elsewhere", fx: "drift" },
    { ...SPOTS.b, side: "left", title: "Era of Verdancy", line: "Present, for now", fx: "bloom" },
    { ...SPOTS.d, side: "left", title: "Entry unknown", line: "Designation withheld", fx: "brackets" },
    { ...SPOTS.b, side: "left", title: "Pressure front", line: "Building slowly", fx: "isobars" },
    { ...SPOTS.d, side: "left", title: "Tide line", line: "Rising", fx: "tideline" },
  ],
];

/** Notes out in space: they describe what is visible there, not lore. */
const SPACE_NOTES: HeroObservation[][] = [
  [
    { x: 30, y: 57, side: "right", title: "Gravitic stream", line: "Flowing in · flowing out", fx: "stream" },
    { x: 54, y: 19, side: "left", title: "Light bending", line: "Source unknown", fx: "glint" },
    { x: 24, y: 64, side: "right", title: "Debris field", line: "Drifting, slowly", fx: "orbit" },
    { x: 53, y: 25, side: "left", title: "Signal", line: "Faint · repeating", fx: "wave" },
    { x: 33, y: 61, side: "right", title: "Cold spot", line: "Below background", fx: "cold" },
    { x: 57, y: 22, side: "left", title: "Lensing arc", line: "Steady", fx: "arc" },
    { x: 27, y: 54, side: "right", title: "Echo", line: "Returning late", fx: "echo" },
    { x: 52, y: 17, side: "left", title: "Sweep", line: "No return", fx: "scan" },
  ],
];
import { WorldStory, type StoryDoor } from "@/components/home/WorldStory";
import { hrefFor, listRecords } from "@/lib/domain/queries";
import { imageFor, peoples } from "@/lib/domain/views";
import { requirePageContext } from "@/lib/server/page-context";

/** The five rooms of the site, as the story's last chapter offers them. */
const DOORS: StoryDoor[] = [
  { href: "/world", index: "01", label: "The World", instrument: "The atlas", line: "The globe, the long history, the Three Consequences." },
  { href: "/people", index: "02", label: "The Peoples", instrument: "The gallery", line: "Portraits, factions, and those who arrived." },
  { href: "/stories", index: "03", label: "The Library", instrument: "Stories", line: "Campaigns, novels, and the short pieces." },
  { href: "/studio", index: "04", label: "The Studio", instrument: "The light table", line: "Art, music, palette and type." },
  { href: "/workshop", index: "05", label: "The Workshop", instrument: "The bench", line: "Prep, prints, builds and the press." },
];

export default async function HomePage() {
  const ctx = await requirePageContext();
  const [state, releases] = await Promise.all([ctx.publicationStore.getActiveState(), ctx.publicationStore.listReleases()]);
  const latest = releases[0];
  const entity = (title: string) => listRecords(state, "entity").find((e) => e.record.title === title);
  const href = (title: string) => {
    const e = entity(title);
    return e ? hrefFor(e.state) : null;
  };
  const code = (title: string) => {
    const e = entity(title);
    return e ? `ID ${e.record.id.slice(0, 8)}` : undefined;
  };
  // Callouts point at real published entries; nothing here asserts new canon.
  // The one fixed callout; it points at a real published entry.
  const callouts: HeroCallout[] = [
    { x: 46, y: 47, side: "right", title: "The Tide", lines: ["Origin unresolved"], href: href("The Tide") ?? href("The Tide (in-lore usage)"), code: code("The Tide") ?? code("The Tide (in-lore usage)") },
  ];

  return (
    <>
      <HomeHero callouts={callouts} observations={OBSERVATIONS} spots={Object.values(SPOTS)} spaceNotes={SPACE_NOTES} code={latest ? `Archive · release v${latest.version}` : "Archive · no release yet"} />
      <WorldStory
        doors={DOORS}
        hrefs={{
          undertow: href("The Undertow") ?? undefined,
          veil: href("The Age of the Veil") ?? undefined,
          ascent: href("The First Ascent") ?? undefined,
          drowning: href("The Drowning") ?? undefined,
          divergence: href("The Divergence") ?? undefined,
          drift: href("The Drift") ?? undefined,
        }}
        peoples={peoples(state)
          .sort((a, b) => Number(!a.record.body) - Number(!b.record.body))
          .map(({ record: p, state: rs }) => ({ id: p.id, title: p.title, href: hrefFor(rs) ?? "/people", portrait: imageFor(state, p.id), palette: p.palette ?? null, epithet: p.aliases?.[0] ?? null }))}
      />
    </>
  );
}
