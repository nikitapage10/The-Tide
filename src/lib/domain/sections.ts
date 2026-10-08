/**
 * The five primary content sections and their nested subpages.
 * Subpages are derived from record kinds/formats, so new kinds slot in here
 * without new routes.
 */
import type { EntityKind, MediaType, StoryFormat } from "@/lib/contract/schema";

export type SectionKey = "world" | "people" | "stories" | "studio" | "workshop";

export interface Subsection {
  slug: string;
  label: string;
  description: string;
}

export interface SectionDef {
  key: SectionKey;
  href: string;
  label: string;
  /** Short label for the top navigation. */
  navLabel: string;
  tagline: string;
  subsections: Subsection[];
}

export const WORLD_KIND_GROUPS: Record<string, { label: string; kinds: EntityKind[]; description: string }> = {
  environments: { label: "Environments", kinds: ["environment"], description: "Biomes, seas and regions of the world." },
  places: { label: "Places", kinds: ["place"], description: "Settlements, sites and named locations." },
  history: { label: "History & events", kinds: ["history", "event"], description: "Cataclysms, cycles and events. Dates may be unknown." },
  technology: { label: "Technology", kinds: ["technology"], description: "Devices, systems and techniques." },
  relics: { label: "Relics", kinds: ["relic"], description: "Artifacts and remnants." },
  phenomena: { label: "Phenomena", kinds: ["phenomenon"], description: "Natural and unnatural forces." },
  workings: { label: "How the world works", kinds: ["world_mechanic"], description: "Rules of the setting (not game mechanics)." },
  concepts: { label: "Concepts & names", kinds: ["concept", "other"], description: "Named ideas whose definitions may not be supplied yet." },
};

export const PEOPLE_KIND_GROUPS: Record<string, { label: string; kinds: EntityKind[]; description: string }> = {
  peoples: { label: "Peoples", kinds: ["people"], description: "The eight established peoples, and others when supplied." },
  characters: { label: "Characters", kinds: ["character"], description: "Named individuals." },
  creatures: { label: "Creatures", kinds: ["creature"], description: "Fauna and beings." },
  factions: { label: "Factions", kinds: ["faction"], description: "Groups with shared aims." },
  institutions: { label: "Institutions", kinds: ["institution"], description: "Organisations, orders and governments." },
};

export const STORY_FORMAT_GROUPS: Record<string, { label: string; formats: StoryFormat[]; description: string }> = {
  campaigns: { label: "Campaigns", formats: ["campaign"], description: "Ongoing tabletop campaigns and their sessions." },
  "one-shots": { label: "One-shots", formats: ["one_shot"], description: "Single-session adventures." },
  novels: { label: "Novels", formats: ["novel"], description: "Long-form fiction, with outlines and chapters." },
  "short-fiction": { label: "Short fiction", formats: ["short_fiction"], description: "Short stories about the world's people." },
};

export const STUDIO_TYPE_GROUPS: Record<string, { label: string; types: MediaType[]; description: string }> = {
  music: { label: "Music", types: ["music"], description: "Tracks and playlists (external links)." },
  artwork: { label: "Artwork", types: ["artwork"], description: "Illustrations and paintings." },
  elements: { label: "Artistic elements", types: ["artistic_element"], description: "Motifs, textures, symbols." },
  aesthetics: { label: "Aesthetics", types: ["aesthetic"], description: "Mood and visual direction." },
  branding: { label: "Branding & design", types: ["branding", "design"], description: "Marks, type and layout." },
  other: { label: "Other", types: ["document", "other"], description: "Everything else." },
};

const toSubs = (groups: Record<string, { label: string; description: string }>): Subsection[] =>
  Object.entries(groups).map(([slug, g]) => ({ slug, label: g.label, description: g.description }));

export const SECTIONS: SectionDef[] = [
  { key: "world", href: "/world", navLabel: "World", label: "The World", tagline: "Environments, places, history, technology and how the world works.", subsections: toSubs(WORLD_KIND_GROUPS) },
  { key: "people", href: "/people", navLabel: "People", label: "People & Powers", tagline: "Peoples, characters, creatures, factions, institutions and their relationships.", subsections: toSubs(PEOPLE_KIND_GROUPS) },
  { key: "stories", href: "/stories", navLabel: "Stories", label: "Stories", tagline: "Campaigns, one-shots, novels and short fiction.", subsections: toSubs(STORY_FORMAT_GROUPS) },
  { key: "studio", href: "/studio", navLabel: "Studio", label: "The Studio", tagline: "Music, artwork, aesthetics, branding and design.", subsections: toSubs(STUDIO_TYPE_GROUPS) },
  {
    key: "workshop",
    href: "/workshop",
    navLabel: "Workshop",
    label: "The Workshop",
    tagline: "Physical builds, the print queue, code, logic and the dashboard itself.",
    subsections: [
      { slug: "prints", label: "Print queue", description: "3D print jobs and attempts." },
      { slug: "builds", label: "Builds", description: "Physical creations, code and logic." },
      { slug: "publishing", label: "Publishing", description: "Import, preview, publish and roll back lore releases." },
      { slug: "sources", label: "Sources", description: "Source references and their access metadata." },
      { slug: "cloud-lab", label: "Cloud lab", description: "Try cloud and weather simulations by hand." },
      { slug: "alphabet-lab", label: "Alphabet lab", description: "Ways for the Tide's script to translate into English." },
      { slug: "orbit-lab", label: "Orbit sketch", description: "Draw how things should move around the planet." },
      { slug: "settings", label: "Connection & settings", description: "Data mode and configuration status." },
    ],
  },
];

const PEOPLE_KINDS = new Set<EntityKind>(Object.values(PEOPLE_KIND_GROUPS).flatMap((g) => g.kinds));

export function sectionForEntityKind(kind: EntityKind): "world" | "people" {
  return PEOPLE_KINDS.has(kind) ? "people" : "world";
}

export function groupForEntityKind(kind: EntityKind): string {
  const groups = sectionForEntityKind(kind) === "people" ? PEOPLE_KIND_GROUPS : WORLD_KIND_GROUPS;
  return Object.entries(groups).find(([, g]) => g.kinds.includes(kind))?.[0] ?? "concepts";
}

export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  environment: "Environment",
  place: "Place",
  history: "History",
  event: "Event",
  technology: "Technology",
  relic: "Relic",
  phenomenon: "Phenomenon",
  world_mechanic: "How the world works",
  concept: "Concept",
  people: "People",
  character: "Character",
  creature: "Creature",
  faction: "Faction",
  institution: "Institution",
  other: "Other",
};
