/**
 * The art (docs/ART_BRIEF.md), cut from the sheets in art/source by
 * scripts/build-art.py into public/art. Pages ask for art by meaning (the
 * sigil of a room, a people's monolith), never by file path.
 */

const A = (p: string) => `/art/${p}.webp`;

/** Rooms (sub-sections) with a sigil, keyed by their slug. */
const ROOM_SIGILS = new Set([
  "environments", "places", "history", "technology", "relics", "phenomena", "workings", "concepts",
  "peoples", "characters", "creatures", "factions", "institutions",
  "campaigns", "one-shots", "novels", "short-fiction",
  "music", "artwork", "elements", "aesthetics", "branding", "other",
  "prints", "builds", "publishing", "sources",
]);

export function roomSigil(slug: string): string | null {
  if (slug.endsWith("-lab")) return A("sigils/rooms/labs");
  return ROOM_SIGILS.has(slug) ? A(`sigils/rooms/${slug}`) : null;
}

export const AGES = ["shoreborn", "undertow", "veil", "verdancy", "tide", "today"] as const;
export type AgeArt = (typeof AGES)[number];
export const ageSigil = (age: AgeArt) => A(`sigils/ages/${age}`);
export const agePanel = (age: AgeArt) => A(`ages/${age}`);

export const CONSEQUENCES = ["drowning", "divergence", "drift"] as const;
export const consequenceSigil = (c: (typeof CONSEQUENCES)[number]) => A(`sigils/ages/${c}`);

/** A people's art, by the slug of its name (nythrok, teruanga...). */
const PEOPLES = ["nythrok", "obscarron", "teruanga", "umbrasa", "resonara", "irridosai", "blightmourn", "syntherion"];
const HOMELANDS = new Set(["nythrok", "obscarron", "teruanga", "umbrasa", "resonara"]);
export const peopleKey = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
export const peopleSigil = (key: string) => (PEOPLES.includes(key) ? A(`sigils/peoples/${key}`) : key === "enclaves" ? A("sigils/peoples/enclaves") : null);
export const monolith = (key: string) => (PEOPLES.includes(key) ? A(`monoliths/${key}`) : null);
export const homeland = (key: string) => (HOMELANDS.has(key) ? A(`homelands/${key}`) : null);

/** The enclaves that arrived with the Drift, by a word from their name. */
const ARRIVALS: [RegExp, string][] = [
  [/normandy/i, "normandy"],
  [/conquistador/i, "conquistadors"],
  [/ara kore|pirate/i, "te-ara-kore"],
  [/armada/i, "armada"],
];
export const arrival = (title: string) => {
  const hit = ARRIVALS.find(([re]) => re.test(title));
  return hit ? A(`arrivals/${hit[1]}`) : null;
};

/** Phenomena, by a word from their name. */
const PHENOMENA: [RegExp, string][] = [
  [/drowning/i, "drowning"],
  [/divergence/i, "divergence"],
  [/drift/i, "drift"],
  [/window/i, "windows-of-memory"],
  [/miasma/i, "echoing-miasma"],
  [/\btide\b/i, "tide"],
];
export const phenomenon = (title: string) => {
  const hit = PHENOMENA.find(([re]) => re.test(title));
  return hit ? A(`phenomena/${hit[1]}`) : null;
};

/** Technology and relics, by a word from their name; otherwise one of the set, by seed. */
const OBJECTS: [RegExp, string][] = [
  [/helio|regulator|mantle/i, "helio-regulator"],
  [/barge|ship|vessel/i, "star-barge"],
  [/condenser|geotherm/i, "geothermal-condenser"],
  [/bridge|gravity/i, "gravity-bridge"],
  [/r[oó]tbook|book/i, "rotbook"],
  [/shoreborn|artefact|artifact/i, "shoreborn-artefact"],
  [/moon|shard/i, "moon-shard"],
  [/idol|obsidian/i, "obsidian-idol"],
];
const TECH = ["helio-regulator", "star-barge", "geothermal-condenser", "gravity-bridge"];
const RELICS = ["rotbook", "shoreborn-artefact", "moon-shard", "obsidian-idol"];
const pick = <T,>(list: readonly T[], seed: string) => list[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length]!;
export const object = (title: string, seed: string, kind: "technology" | "relic") => {
  const hit = OBJECTS.find(([re]) => re.test(title));
  return A(`objects/${hit ? hit[1] : pick(kind === "relic" ? RELICS : TECH, seed)}`);
};

export const ENVIRONMENTS = ["sea", "desert", "forest", "abyss"] as const;
export const environmentBand = (title: string, seed: string) => {
  const t = title.toLowerCase();
  const hit = /sea|ocean|coast|shore|tide|drown/.test(t) ? "sea" : /desert|dune|sand|storm/.test(t) ? "desert" : /forest|wood|grove|jungle|fibre|fiber/.test(t) ? "forest" : /abyss|deep|trench|dark/.test(t) ? "abyss" : null;
  return A(`environments/${hit ?? pick(ENVIRONMENTS, seed)}`);
};

/** Stand-ins for anything without its own art yet. */
export const unknown = (kind: "figure" | "creature" | "landscape") => A(`unknowns/${kind}`);

export const numeral = (d: string) => A(`numerals/${d}`);
export const glyph = (name: string) => A(`glyphs/${name}`);
export const marker = (name: string) => A(`markers/${name}`);
export const volume = (name: "novel" | "campaign" | "one-shot" | "chapbook") => A(`volumes/${name}`);
export const texture = (name: "grain" | "mist" | "threads") => A(`textures/${name}`);

export const ART = {
  story: { arrival: A("story/arrival"), before: A("story/before"), veil: A("story/veil"), verdancy: A("story/verdancy"), tide: A("story/tide"), enter: A("story/enter") },
  heroes: { world: A("heroes/world"), people: A("heroes/people") },
  backdrops: { stories: A("backdrops/library"), studio: A("backdrops/studio"), workshop: A("backdrops/workshop") },
  survey: A("world/survey"),
  river: A("river"),
  vitrine: A("vitrine"),
} as const;
