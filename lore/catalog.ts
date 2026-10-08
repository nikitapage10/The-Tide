/**
 * The lore catalog: what the GM's documents (lore/docs/*.md) become as
 * published records. Built into a publication bundle by
 * scripts/build-lore-bundle.ts.
 *
 * - `name` is the stable name ("people/teruanga"); the record ID is derived
 *   from it (src/lib/contract/ids.ts) unless `id` keeps an existing record's ID.
 * - `body` is either literal Markdown or a reference to a document (and
 *   optionally one section of it), copied verbatim.
 * - Summaries are short and quiet; the documents hold the detail.
 * - The world is Ilyr (ih-LEER, /ɪˈliːr/), from the Teruānga for "light that
 *   remains"; adjective Ilyrian. (Primus was its working name.)
 */
import type { CanonStatus, EntityKind, Era, Visibility } from "../src/lib/contract/schema";

export type Body = string | { doc: string; section?: string; until?: string };

export interface EntityEntry {
  name: string;
  id?: string;
  kind: EntityKind;
  title: string;
  summary: string;
  body?: Body;
  era?: Era;
  chronology?: { label: string; certainty: "unknown" | "uncertain" | "approximate" | "confirmed"; sortKey?: number; notes?: string };
  parent?: string;
  aliases?: string[];
  tags?: string[];
  palette?: string;
  canon?: CanonStatus;
  visibility?: Visibility;
  source?: string;
  portrait?: string;
}

export interface RelationEntry {
  from: string;
  to: string;
  label: string;
  inverse?: string;
  note?: string;
}

export interface QuestionEntry {
  name: string;
  id?: string;
  title: string;
  summary: string;
  body?: string;
  status: "open" | "resolved";
  related: string[];
}

/** Existing records from the first release, kept by ID. */
export const EXISTING: Record<string, string> = {
  "world/primus": "263af39c-3500-41ef-b891-5f3bbcdf45f2",
  "history/cataclysms": "e2460018-cc1e-44dd-8e3f-db871722a6da",
  "phenomenon/the-drowning": "9c0b36a4-1211-4f0d-879e-215f8fc77bcf",
  "phenomenon/the-divergence": "497daed1-2010-4bcc-8500-befa5a237c63",
  "phenomenon/the-drift": "c61ddb6e-a3cc-45c7-ab3a-ee376b527d4d",
  "event/the-undertow": "909a4973-956d-4700-8ff8-39b908012473",
  "history/age-of-the-veil": "f6e7f171-0575-46f4-8ea8-182eee80a50c",
  "phenomenon/the-tide": "33c80aca-bc2e-4aa4-8255-a9f90d50aa04",
  "people/blightmourn": "dabef000-c21e-451e-a73e-33401893896e",
  "people/irridosai": "8c61dc8d-c5d7-4371-b63e-72b07166f509",
  "people/nythrok": "29b07ecc-8191-4579-8fd5-ac1d70795ccc",
  "people/obscarron": "932dad00-579f-45db-83e9-215201f5afab",
  "people/resonara": "e8cb646a-3b27-4ae8-90cd-d46bcd01e994",
  "people/syntherion": "91026a63-0ca2-4cc3-bf1e-22f80a4cbc08",
  "people/teruanga": "dbc4d47c-1535-466c-bacb-8ca47aacb897",
  "people/umbrasa": "6029ef13-b955-49cb-88c5-52382cd4d17f",
  "question/era-naming": "53340920-1a41-42b2-ac4a-7ba94e55af72",
  "question/world-name": "00c590f6-0dd6-4d37-b963-2c57ce821ad2",
};

/** Source documents (lore/docs/<doc>.md). */
export const SOURCES: Record<string, string> = {
  intro: "The Tide – Intro",
  "tide-101": "Tide 101",
  nythrok: "Nyth'rok",
  obscarron: "Obscarron",
  teruanga: "Teruānga",
  umbrasa: "Umbrasa",
  resonara: "Resonara",
  "normandy-enclave": "The Normandy Enclave",
};

const P = (doc: string, section: string, until?: string): Body => ({ doc, section, until });

export const ENTITIES: EntityEntry[] = [
  // ── The world and its ages ───────────────────────────────────────────────
  {
    name: "world/primus",
    kind: "place",
    title: "Ilyr",
    aliases: ["Earth"],
    summary: "The world of The Tide: Earth, long after. Ilyr (ih-LEER, /ɪˈliːr/), from the Teruānga for \u201clight that remains\u201d.",
    body: P("tide-101", "Terminology"),
    era: "today",
    tags: ["the world"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "history/before-the-undertow",
    kind: "history",
    title: "Before the Undertow",
    aliases: ["B.U.", "The Shoreborn era"],
    summary: "The age of the Shoreborn: warming, strain, a desperate surge of invention and a nine-year golden era, then the end.",
    body: P("tide-101", "Before the Undertow (B.U.)"),
    era: "before_undertow",
    chronology: { label: "until ~2102 B.U.", certainty: "approximate", sortKey: 2012 },
    parent: "world/primus",
    tags: ["era"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "concept/shoreborn",
    kind: "concept",
    title: "Shoreborn",
    aliases: ["Whānauta"],
    summary: "The humans of the world before the Undertow; a Teruānga word, “born of the shore”.",
    era: "before_undertow",
    tags: ["terminology"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "event/the-undertow",
    kind: "event",
    title: "The Undertow",
    summary: "The first great cataclysm: about nine months of upheaval that drowned coastlines, bent gravity and ended the Shoreborn.",
    body:
      "The singular cataclysm, circa 2102 B.U., that ended the Shoreborn civilization. For about nine months the planet convulsed: extreme geological upheaval, unprecedented atmospheric phenomena, gravitational anomalies and minor incursions of energies from beyond known reality. Coastlines were redrawn, most of the population perished, and the survivors were irrevocably altered, the beginning of the Ilyrian races.\n\nEach people remembers it differently: the Veigrstorm of the Nyth'rok, the eruptions that buried the Obscarron, the surge that dragged the Teruānga into the abyss, the Song of Unmaking of the Resonara, and the shattering of the moon that made the Umbrasa.",
    era: "undertow",
    chronology: { label: "~2102 B.U.", certainty: "approximate", sortKey: 2102 },
    tags: ["cataclysm"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "history/age-of-the-veil",
    kind: "history",
    title: "The Age of the Veil",
    aliases: ["Age of the Abyssal Veil", "A.V."],
    summary: "Some seven centuries of isolation after the Undertow: a dark age of slow transformation, when each people became itself alone.",
    body: P("tide-101", "Age of the Veil (A.V.)"),
    era: "veil",
    chronology: { label: "~700 years after the Undertow", certainty: "approximate", sortKey: 2103 },
    tags: ["era"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "history/era-of-verdancy",
    kind: "history",
    title: "The Era of Verdancy",
    aliases: ["E.V."],
    summary: "Recorded history: the peoples find each other again, trade and quarrel, outgrow the Shoreborn, and reach the moon and other worlds.",
    body: P("tide-101", "Era of Verdancy (E.V.)"),
    era: "verdancy",
    chronology: { label: "~3200 years, to the present", certainty: "approximate", sortKey: 2800 },
    tags: ["era"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "event/the-first-ascent",
    kind: "event",
    title: "The First Ascent",
    aliases: ["Ascent of the Wild Ones"],
    summary: "Five young Teruānga, swept far by a current, save a drowning Irridosai girl, and the long isolation ends.",
    body:
      "Five young Teruānga, near the age of their Te Heke descent, were carried by an unexpected current to the cliffs of an unknown island, the homeland of the Irridosai. They saw a girl fall from the cliffs into the sea, and brought her ashore and back to her people. Unharmed by the island's radiation, they were taken to the elders, sheltered through a storm, and sent home with supplies.\n\nTheir story set the Teruānga voyaging. Contact with the Irridosai grew into a partnership, and the Teruānga went on to reach the Blightmourn, the Umbrasa, the Nyth'rok and others, carrying language and record-keeping with them. The event marks the beginning of the Era of Verdancy. Teruānga historians prefer “the Ascent of the Wild Ones”: their people had reached land before.",
    era: "verdancy",
    chronology: { label: "the dawn of the Era of Verdancy", certainty: "approximate", sortKey: 2801 },
    parent: "history/era-of-verdancy",
    tags: ["contact"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "history/the-reaching",
    kind: "history",
    title: "Among the stars",
    summary: "Late in the Era of Verdancy: colonies on the moon and other planets, orbital habitats, and the first expeditions toward other stars.",
    body:
      "In the millennia after the First Ascent, technology quickly surpassed the Shoreborn. Cities sprawled across continents and rose among the clouds. Several nations together re-established a presence in space: permanent colonies on the moon and on other planets of the system, orbital habitats, interplanetary trade. Just before the Tide, the most advanced factions were launching their first expeditions toward other stars.",
    era: "verdancy",
    chronology: { label: "late Era of Verdancy, before the Tide", certainty: "uncertain", sortKey: 5600 },
    parent: "history/era-of-verdancy",
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "phenomenon/the-tide",
    kind: "phenomenon",
    title: "The Tide",
    summary: "The second great upheaval, still unfolding: not one blow but a long disruption, known by its Three Consequences.",
    body: P("tide-101", "The Tide"),
    era: "tide",
    chronology: { label: "the later centuries of the Era of Verdancy; perhaps ongoing", certainty: "uncertain", sortKey: 5800 },
    tags: ["cataclysm", "three consequences"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "phenomenon/the-drowning",
    kind: "phenomenon",
    title: "The Drowning",
    summary: "The first Consequence: coastlines swallowed, continents rent, mountains torn loose to drift in the sky.",
    body:
      "Extreme geological and hydrological instability on a planetary scale: coastlines vanished beneath rising waters, earthquakes rent continents, volcanoes roared back to life, and vast tracts of land were torn from the surface to become the Floating Mountains.\n\nAmong the peoples it took many forms: the Stillholds of the Nyth'rok, the Great Petrification of the Obscarron's lava rivers, the Abyssal Divide that cut the Teruānga elders off, the Echoing Miasma that drove the Resonara from their paradise, and the fracturing of the Umbrasa's lunar shards.",
    era: "tide",
    chronology: { label: "the Tide", certainty: "uncertain", sortKey: 5801 },
    parent: "phenomenon/the-tide",
    tags: ["three consequences"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "phenomenon/the-divergence",
    kind: "phenomenon",
    title: "The Divergence",
    summary: "The second Consequence: latent powers wake. Gravity, time, matter, minds and energy answer new masters.",
    body:
      "A poorly understood event, perhaps a wave of cosmic energy or a shift in underlying reality, that unlocked latent potential within the Ilyrian races. It amplified existing traits or granted new abilities tied to fundamental forces (gravity, entropy, quantum effects, electromagnetism), and with them rapid shifts of power and new elites, like the Geomagnus.\n\nThe Nyth'rok gained three branches of quantum power; the Obscarron, magnetism and geothermal force; the Teruānga, pressure and the heat of the deep; the Umbrasa, mass itself; the Resonara, waves of sound, light and thought.",
    era: "tide",
    chronology: { label: "the Tide", certainty: "uncertain", sortKey: 5802 },
    parent: "phenomenon/the-tide",
    tags: ["three consequences", "powers"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "phenomenon/the-drift",
    kind: "phenomenon",
    title: "The Drift",
    summary: "The third Consequence: rifts open, and fragments of other times and places wash ashore as enclaves.",
    body:
      "Spacetime frayed, opening Drifts: shimmering anomalies through which fragments of other realities and timelines arrive unbidden. Whole populations, relics of forgotten epochs and shards of alien worlds materialise across the planet as enclaves, among them puzzling remnants of the Shoreborn world.\n\nThe Normandy Enclave, the Conquistador Brotherhood, the pirates and the Armada of Te Ara Kore all came this way.",
    era: "tide",
    chronology: { label: "the Tide; ongoing", certainty: "uncertain", sortKey: 5803 },
    parent: "phenomenon/the-tide",
    tags: ["three consequences", "enclaves"],
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "place/floating-mountains",
    kind: "place",
    title: "The Floating Mountains",
    summary: "Land torn loose by the Drowning, adrift on currents of altered gravity.",
    era: "tide",
    parent: "world/primus",
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "history/cataclysms",
    kind: "history",
    title: "Cataclysms",
    summary: "Two great upheavals shape the world: the Undertow, which ended the Shoreborn, and the Tide, which is still unfolding.",
    canon: "provisional",
    visibility: "public",
    source: "tide-101",
  },
  {
    name: "concept/mana",
    kind: "world_mechanic",
    title: "Mana",
    aliases: ["Aether"],
    summary: "A metaphysical energy the Teruānga first knew in their long suspension; the Drowning revealed it as Aether.",
    tags: ["teruanga"],
    canon: "provisional",
    source: "teruanga",
  },

  // ── The peoples ─────────────────────────────────────────────────────────
  {
    name: "people/nythrok",
    kind: "people",
    title: "Nyth'rok",
    summary: "Tall, pale people of the northern fjords, remade by a quantum storm; keepers of the Deep Root and its living book.",
    body: { doc: "nythrok" },
    palette: "#b9c7d6",
    tags: ["the eight peoples"],
    canon: "provisional",
    visibility: "public",
    source: "nythrok",
    portrait: "/lore/peoples/nythrok.webp",
  },
  {
    name: "people/obscarron",
    kind: "people",
    title: "Obscarron",
    aliases: ["Children of the Core"],
    summary: "Obsidian-skinned, molten-veined, born from the earth's crust after centuries of stone sleep; their cities run on rivers of fire.",
    body: { doc: "obscarron" },
    palette: "#d0703a",
    tags: ["the eight peoples"],
    canon: "provisional",
    visibility: "public",
    source: "obscarron",
    portrait: "/lore/peoples/obscarron.webp",
  },
  {
    name: "people/teruanga",
    kind: "people",
    title: "Teruānga",
    aliases: ["Shells of the Abyss"],
    summary: "Shelled people of the deep ocean, lit by ember-like markings; the navigators who found everyone again.",
    body: { doc: "teruanga" },
    palette: "#c8a84a",
    tags: ["the eight peoples"],
    canon: "provisional",
    visibility: "public",
    source: "teruanga",
    portrait: "/lore/peoples/teruanga.webp",
  },
  {
    name: "people/umbrasa",
    kind: "people",
    title: "Umbrasa",
    aliases: ["Laughing Shadows"],
    summary: "Small, armoured miners of the shattered moon who breathe helium and exhale light; they came down to the world on star-barges.",
    body: { doc: "umbrasa" },
    palette: "#8fcfc4",
    tags: ["the eight peoples"],
    canon: "provisional",
    visibility: "public",
    source: "umbrasa",
    portrait: "/lore/peoples/umbrasa.webp",
  },
  {
    name: "people/resonara",
    kind: "people",
    title: "Resonara",
    summary: "Beings of white, silken fibre who see with sound and thought; wandering troupes since a fog swallowed their paradise.",
    body: { doc: "resonara" },
    palette: "#e6e1d6",
    tags: ["the eight peoples"],
    canon: "provisional",
    visibility: "public",
    source: "resonara",
    portrait: "/lore/peoples/resonara.webp",
  },
  {
    name: "people/irridosai",
    kind: "people",
    title: "Irridosai",
    summary: "A radiant people of a lush, dangerous island of cliffs; the first the Teruānga found. Details to come.",
    tags: ["the eight peoples"],
    canon: "unverified",
    visibility: "public",
    source: "tide-101",
    portrait: "/lore/peoples/irridosai.webp",
  },
  {
    name: "people/blightmourn",
    kind: "people",
    title: "Blightmourn",
    summary: "A people of harsh deserts, reached by early Teruānga voyages. Details to come.",
    tags: ["the eight peoples"],
    canon: "unverified",
    visibility: "public",
    source: "tide-101",
    portrait: "/lore/peoples/blightmourn.webp",
  },
  {
    name: "people/syntherion",
    kind: "people",
    title: "Syntherion",
    summary: "One of the eight peoples. Still being written.",
    tags: ["the eight peoples"],
    canon: "unverified",
    visibility: "public",
    portrait: "/lore/peoples/syntherion.webp",
  },

  // ── Nyth'rok ─────────────────────────────────────────────────────────────
  { name: "faction/nythvael", kind: "faction", title: "Nyth'vael", aliases: ["The Timeless Guardians"], summary: "The trunk of Nyth'rok society: traditionalists of the Rótbook, and guardians of time.", body: P("nythrok", "The Rótbook and the Rise of the Nyth’vael"), parent: "people/nythrok", palette: "#b9c7d6", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "faction/nythvyr", kind: "faction", title: "Nyth'vyr", aliases: ["The Unrooted"], summary: "Solitary wanderers and warriors who left the Root; they marched home when the Drowning came.", body: P("nythrok", "The Nyth’vyr: The Unrooted"), parent: "people/nythrok", palette: "#b9c7d6", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "faction/nythdar", kind: "faction", title: "Nyth'dar", aliases: ["The Boundless"], summary: "Scholar-monks of time in three castes: Tellers of Tomorrow, Preservers of the Present, Pilgrims of the Past.", body: P("nythrok", "The Nyth’dar: Scholars of the Boundless"), parent: "people/nythrok", palette: "#b9c7d6", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "faction/nythrundr", kind: "faction", title: "Nyth'rundr", summary: "Purists who reshape themselves and live in time-warped Aeternums.", body: P("nythrok", "The Nyth’rundr: Extremists of the Aeternums"), parent: "people/nythrok", palette: "#b9c7d6", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "concept/dyprot", kind: "concept", title: "Dýprót", aliases: ["The Deep Root"], summary: "The Nyth'rok way: every choice a root of the World Tree.", body: P("nythrok", "Technological Growth Rooted in Dýprót"), parent: "people/nythrok", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "relic/rotbook", kind: "relic", title: "The Rótbook", summary: "The living sacred archive of the Nyth'rok. It holds no record of the Undertow.", parent: "people/nythrok", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "event/veigrstorm", kind: "event", title: "The Veigrstorm", summary: "The quantum storm of the Undertow that stretched the Nyth'rok and took their memories.", body: P("nythrok", "Origins and Early Evolution (Post-Undertow)"), era: "undertow", chronology: { label: "the Undertow", certainty: "approximate", sortKey: 2102.1 }, parent: "people/nythrok", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "event/march-of-the-seedbearers", kind: "event", title: "The March of the Seedbearers", summary: "When the Drowning came, the Unrooted came home.", body: P("nythrok", "March of the Seedbearers"), era: "tide", chronology: { label: "the Drowning", certainty: "uncertain", sortKey: 5801.2 }, parent: "people/nythrok", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "place/stillholds", kind: "place", title: "The Stillholds", summary: "Nyth'rok cities the Drowning emptied or froze in time; shadows burned onto their walls.", body: P("nythrok", "The First Consequence: The Drowning"), era: "tide", parent: "people/nythrok", canon: "provisional", visibility: "player_safe", source: "nythrok" },
  { name: "place/aeternums", kind: "place", title: "The Aeternums", summary: "Time-warped strongholds of the Nyth'rundr.", parent: "faction/nythrundr", canon: "provisional", visibility: "player_safe", source: "nythrok" },

  // ── Obscarron ────────────────────────────────────────────────────────────
  { name: "faction/geomagnus", kind: "faction", title: "The Geomagnus", summary: "Masters of magnetism and geothermal force who rose in the Divergence and rule the Obscarron by it.", body: P("obscarron", "The Geomagnus: Masters of Electromagnetism and Geothermal Energy"), parent: "people/obscarron", palette: "#d0703a", canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "institution/elders-of-the-core", kind: "institution", title: "The Elders of the Core", summary: "The spiritual and political leaders of the Obscarron, keepers of the Ashen Offerings.", body: P("obscarron", "Religious Reverence and Sacrificial Practices"), parent: "people/obscarron", canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "faction/obscarron-resistance", kind: "faction", title: "The Resistance", summary: "Obscarron who hide the hunted Conquistadors from the Geomagnus.", body: P("obscarron", "Resistance from Within"), parent: "people/obscarron", canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "event/shatterbirth", kind: "event", title: "The Shatterbirth", summary: "The Obscarron burst from the crust after centuries in stone, with only fragments of memory.", body: P("obscarron", "The Shatterbirth (Rebirth)"), era: "veil", chronology: { label: "late, after a long stasis", certainty: "uncertain", sortKey: 2400 }, parent: "people/obscarron", canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "event/great-petrification", kind: "event", title: "The Great Petrification", summary: "Floodwaters hardened the rivers of lava; the cities' veins froze, and so did faith.", body: P("obscarron", "The Drowning: The Frozen Flow"), era: "tide", chronology: { label: "the Drowning", certainty: "uncertain", sortKey: 5801.3 }, parent: "people/obscarron", canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "event/the-cull", kind: "event", title: "The Cull", summary: "The Geomagnus hunt the Conquistador Brotherhood for sport.", body: P("obscarron", "The Cull: A Hunt of Cruelty and Sport"), era: "tide", chronology: { label: "after the Drift", certainty: "uncertain", sortKey: 5803.3 }, parent: "people/obscarron", canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "place/molten-cities", kind: "place", title: "The Molten Cities", summary: "Obscarron cities of obsidian and metal spires, powered by rivers of Earthblood.", body: P("obscarron", "The Molten Cities and Technological Development"), parent: "people/obscarron", canon: "provisional", visibility: "player_safe", source: "obscarron" },

  // ── Teruānga ─────────────────────────────────────────────────────────────
  { name: "faction/nagga-kai", kind: "faction", title: "The Nagga Kai", aliases: ["Ngā Kaihautu Wai", "Claimants of the Drowned"], summary: "Teruānga who hold the ocean above all, and mean to rule the drowned lands.", body: P("teruanga", "The Rise of the Nagga Kai (Claimants of the Drowned)"), parent: "people/teruanga", palette: "#c8a84a", canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "faction/wayfarers", kind: "faction", title: "The Wayfarers", summary: "Young Teruānga of the surface: merchants, captains and explorers.", body: P("teruanga", "Exploration Beyond Water"), parent: "people/teruanga", palette: "#c8a84a", canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "concept/te-heke", kind: "concept", title: "Te Heke", aliases: ["The Descent"], summary: "The Teruānga rite of life: each age lived deeper in the ocean, the elders at the volcanic depths.", body: P("teruanga", "Te Heke: The Descent"), parent: "people/teruanga", canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "event/te-whakarere", kind: "event", title: "Te Whakarere", aliases: ["The Suspension", "Te Moemoeā Nui", "The Great Dream"], summary: "Centuries suspended in the abyss, and the shared dream that gave the Teruānga their ways.", body: P("teruanga", "Becoming the Shells of the Abyss"), era: "veil", chronology: { label: "the Age of the Veil", certainty: "uncertain", sortKey: 2150 }, parent: "people/teruanga", canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "place/abyssal-divide", kind: "place", title: "The Abyssal Divide", summary: "A barrier of magma that rose in the Drowning and cut the Teruānga elders off from their people.", body: P("teruanga", "The Abyssal Divide"), era: "tide", parent: "people/teruanga", canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "place/te-ara-kore", kind: "place", title: "Te Ara Kore", aliases: ["The Path Without Boundaries"], summary: "A stretch of sea that draws fragments of time and place into its waters.", body: P("teruanga", "The Drift"), parent: "people/teruanga", canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "event/battle-of-te-ara-kore", kind: "event", title: "The Battle of Te Ara Kore", summary: "Teruānga defend pirates out of the Drift; the Nagga Kai side with an Armada out of spite.", body: P("teruanga", "The Battle of Te Ara Kore: A Misplaced Alliance", "The Teruānga Today: Post-Tide"), era: "tide", chronology: { label: "after the Drift", certainty: "uncertain", sortKey: 5803.2 }, parent: "place/te-ara-kore", canon: "provisional", visibility: "player_safe", source: "teruanga" },

  // ── Umbrasa ──────────────────────────────────────────────────────────────
  { name: "faction/mass-weavers", kind: "faction", title: "The Mass-Weavers", summary: "Umbrasa spiritual leaders of the Divergence, who levitate and anchor themselves at will.", parent: "people/umbrasa", palette: "#8fcfc4", canon: "provisional", visibility: "player_safe", source: "umbrasa" },
  { name: "institution/gravitar", kind: "institution", title: "The Gravitar", summary: "Couriers who cross between the moon's shards, trailing light.", parent: "people/umbrasa", canon: "provisional", visibility: "player_safe", source: "umbrasa" },
  { name: "place/primordial-aukar", kind: "place", title: "The Primordial Aukar", summary: "A small black hole born in the Undertow, holding the moon's fragments in a long, distorted pendant.", body: P("umbrasa", "Origins and Early Evolution (Post-Undertow)"), era: "undertow", canon: "provisional", visibility: "player_safe", source: "umbrasa" },
  { name: "place/lunar-shards", kind: "place", title: "The Lunar Shards", summary: "The broken moon, settled by the Umbrasa through the Age of the Veil.", body: P("umbrasa", "The Age of the Abyssal Veil"), parent: "place/primordial-aukar", canon: "provisional", visibility: "player_safe", source: "umbrasa" },
  { name: "event/the-return", kind: "event", title: "The Return", summary: "Umbrasa star-barges reach the world's mountain plateaus; the locals name them Laughing Shadows.", body: P("umbrasa", "The Return to Ilyr (Era of Verdancy)"), era: "verdancy", chronology: { label: "the Era of Verdancy", certainty: "uncertain", sortKey: 3200 }, parent: "people/umbrasa", canon: "provisional", visibility: "player_safe", source: "umbrasa" },
  { name: "technology/helio-regulator", kind: "technology", title: "Helio-Regulator mantles", summary: "Fungal mantles that make helium, so the Umbrasa can live in the world's air.", parent: "people/umbrasa", canon: "provisional", visibility: "player_safe", source: "umbrasa" },

  // ── Resonara ─────────────────────────────────────────────────────────────
  { name: "faction/echocrafters", kind: "faction", title: "Echocrafters", summary: "Resonara who shape waves into constructs, summoned beings and armour.", body: P("resonara", "Advanced Wave Manipulation"), parent: "people/resonara", palette: "#e6e1d6", canon: "provisional", visibility: "player_safe", source: "resonara" },
  { name: "faction/sons-of-the-sirens", kind: "faction", title: "Sons of the Sirens", summary: "Destructive Resonara mercenaries.", body: P("resonara", "Sons of the Sirens"), parent: "people/resonara", palette: "#e6e1d6", canon: "provisional", visibility: "player_safe", source: "resonara" },
  { name: "event/song-of-unmaking", kind: "event", title: "The Song of Unmaking", summary: "Where a weapons project had thinned the walls of the world, the Undertow sang.", body: P("resonara", "The Song of Unmaking"), era: "undertow", chronology: { label: "the Undertow", certainty: "approximate", sortKey: 2102.2 }, parent: "people/resonara", canon: "provisional", visibility: "player_safe", source: "resonara" },
  { name: "phenomenon/windows-of-memory", kind: "phenomenon", title: "Windows of Memory", summary: "Brief rifts that show the Resonara the past and the future.", body: P("resonara", "The Emergence of the Windows of Memory"), era: "veil", parent: "people/resonara", canon: "provisional", visibility: "player_safe", source: "resonara" },
  { name: "phenomenon/echoing-miasma", kind: "phenomenon", title: "The Echoing Miasma", summary: "A dark fog that swallows sound and light; the Resonara's Drowning.", body: P("resonara", "The Drowning"), era: "tide", parent: "people/resonara", canon: "provisional", visibility: "player_safe", source: "resonara" },

  // ── Enclaves (the Drift) ─────────────────────────────────────────────────
  {
    name: "enclave/normandy",
    kind: "people",
    title: "The Normandy Enclave",
    summary: "Soldiers of both sides of a beach landing, pulled through a rift on a moonlit night; now one wary town of salvage and steel.",
    body: { doc: "normandy-enclave" },
    era: "tide",
    palette: "#a68a72",
    tags: ["enclave"],
    canon: "provisional",
    visibility: "public",
    source: "normandy-enclave",
  },
  { name: "enclave/conquistador-brotherhood", kind: "people", title: "The Conquistador Brotherhood", summary: "An enclave out of the Drift, hunted by the Geomagnus and hidden by those who pity them.", body: P("obscarron", "The Drift: The Conquistador Brotherhood and the Hunt"), era: "tide", palette: "#a68a72", tags: ["enclave"], canon: "provisional", visibility: "player_safe", source: "obscarron" },
  { name: "enclave/pirates-of-te-ara-kore", kind: "people", title: "The pirates of Te Ara Kore", summary: "Sailors out of the Drift who took the Teruānga for agents of Calypso.", era: "tide", palette: "#a68a72", tags: ["enclave"], canon: "provisional", visibility: "player_safe", source: "teruanga" },
  { name: "enclave/the-armada", kind: "people", title: "The Armada", summary: "A fleet out of the Drift, aided by the Nagga Kai.", era: "tide", palette: "#a68a72", tags: ["enclave"], canon: "provisional", visibility: "player_safe", source: "teruanga" },
];

export const RELATIONS: RelationEntry[] = [
  { from: "faction/nythvael", to: "people/nythrok", label: "Faction of", inverse: "Factions" },
  { from: "faction/nythvyr", to: "people/nythrok", label: "Faction of", inverse: "Factions" },
  { from: "faction/nythdar", to: "people/nythrok", label: "Faction of", inverse: "Factions" },
  { from: "faction/nythrundr", to: "people/nythrok", label: "Faction of", inverse: "Factions" },
  { from: "faction/geomagnus", to: "people/obscarron", label: "Faction of", inverse: "Factions" },
  { from: "institution/elders-of-the-core", to: "people/obscarron", label: "Faction of", inverse: "Factions" },
  { from: "faction/obscarron-resistance", to: "people/obscarron", label: "Faction of", inverse: "Factions" },
  { from: "faction/nagga-kai", to: "people/teruanga", label: "Faction of", inverse: "Factions" },
  { from: "faction/wayfarers", to: "people/teruanga", label: "Faction of", inverse: "Factions" },
  { from: "faction/mass-weavers", to: "people/umbrasa", label: "Faction of", inverse: "Factions" },
  { from: "institution/gravitar", to: "people/umbrasa", label: "Faction of", inverse: "Factions" },
  { from: "faction/echocrafters", to: "people/resonara", label: "Faction of", inverse: "Factions" },
  { from: "faction/sons-of-the-sirens", to: "people/resonara", label: "Faction of", inverse: "Factions" },
  { from: "event/the-first-ascent", to: "people/teruanga", label: "Involved", inverse: "Took part in" },
  { from: "event/the-first-ascent", to: "people/irridosai", label: "Involved", inverse: "Took part in" },
  { from: "faction/geomagnus", to: "enclave/conquistador-brotherhood", label: "Hunts", inverse: "Hunted by" },
  { from: "faction/obscarron-resistance", to: "enclave/conquistador-brotherhood", label: "Shelters", inverse: "Sheltered by" },
  { from: "faction/nagga-kai", to: "people/obscarron", label: "At war with", inverse: "At war with" },
  { from: "people/teruanga", to: "enclave/pirates-of-te-ara-kore", label: "Defended", inverse: "Defended by" },
  { from: "faction/nagga-kai", to: "enclave/the-armada", label: "Aided", inverse: "Aided by" },
  { from: "place/molten-cities", to: "people/obscarron", label: "Home of", inverse: "Home" },
  { from: "place/stillholds", to: "people/nythrok", label: "Home of", inverse: "Home" },
  { from: "place/lunar-shards", to: "people/umbrasa", label: "Home of", inverse: "Home" },
  { from: "people/umbrasa", to: "place/primordial-aukar", label: "Make pilgrimage to", inverse: "Pilgrims" },
  { from: "people/resonara", to: "phenomenon/the-drift", label: "Interpreters of", inverse: "Interpreted by" },
  { from: "people/nythrok", to: "phenomenon/the-drift", label: "Strangely at home with", inverse: "Strangely familiar to" },
];

export const QUESTIONS: QuestionEntry[] = [
  {
    name: "question/world-name",
    title: "The world's name",
    summary: "Settled: the world is Ilyr (ih-LEER, /ɪˈliːr/), from the Teruānga for “light that remains”; adjective Ilyrian. The documents' working name was replaced throughout.",
    status: "resolved",
    related: ["world/primus"],
  },
  {
    name: "question/era-naming",
    title: "The Undertow, the Age of the Veil and the Tide",
    summary: "Settled by Tide 101: the Undertow (~2102 B.U.), then the Age of the Veil (~700 years), then the Era of Verdancy, within which the Tide occurs.",
    status: "resolved",
    related: ["event/the-undertow", "history/age-of-the-veil", "phenomenon/the-tide"],
  },
  {
    name: "question/veil-length",
    title: "How long was the Age of the Veil?",
    summary: "Tide 101 says about 700 years; the Umbrasa document about 900; the Resonara document “thousands of years”.",
    status: "open",
    related: ["history/age-of-the-veil", "people/umbrasa", "people/resonara"],
  },
  {
    name: "question/petrification",
    title: "The Petrification and the Geomagnus",
    summary: "The Obscarron document: floods hardened the lava rivers and the Geomagnus rose in the Divergence. The Teruānga document: a creeping calcification, with the Geomagnus rising because of it, and a Nagga Kai invasion of flooded Obscarron lands that the Obscarron document never mentions (it also says they lived far from the oceans).",
    status: "open",
    related: ["event/great-petrification", "faction/geomagnus", "faction/nagga-kai", "people/obscarron", "people/teruanga"],
  },
  {
    name: "question/nythrok-drafts",
    title: "Two drafts of the Nyth'rok today",
    summary: "The Nyth'rok document has two Drift sections and two “today” sections that disagree (the Nyth'vael dominant across the world vs dwindling in the Stillholds), and gives time powers to different factions in different places.",
    status: "open",
    related: ["people/nythrok", "faction/nythvael", "faction/nythvyr", "faction/nythrundr"],
  },
  {
    name: "question/umbrasa-undertow",
    title: "The Umbrasa's Three Consequences",
    summary: "The Umbrasa document ties the Three Consequences to the Undertow and describes the Drowning as gravitational fracturing on the moon, unlike the other documents.",
    status: "open",
    related: ["people/umbrasa", "phenomenon/the-drowning"],
  },
  {
    name: "question/normandy-ships",
    title: "Aircraft carriers at Normandy",
    summary: "The enclave's beached aircraft carriers were not part of the landings; perhaps landing craft or battleships, or something the Drift brought from another time.",
    status: "open",
    related: ["enclave/normandy"],
  },
  {
    name: "question/zorya",
    title: "Operation or Project Zorya",
    summary: "The Resonara document uses both names for the weapons project behind the Song of Unmaking.",
    status: "open",
    related: ["event/song-of-unmaking", "people/resonara"],
  },
  {
    name: "question/irridosai-name",
    title: "Irridosai or Irridosa",
    summary: "Tide 101 says Irridosai; the Teruānga document says Irridosa (and mentions their Aetherfallen).",
    status: "open",
    related: ["people/irridosai", "people/teruanga"],
  },
  {
    name: "question/syntherion",
    title: "The Syntherion",
    summary: "One of the eight peoples, not yet written.",
    status: "open",
    related: ["people/syntherion"],
  },
];

/** Records from the first release that the documents have settled; archived (still readable). */
export const ARCHIVE: { id: string; reason: string }[] = [
  { id: "9a46b54a-e616-430f-a561-ca41b7aff4dc", reason: "Settled by Tide 101: the Undertow, then the Age of the Veil, then the Era of Verdancy and the Tide." },
  { id: "e0610884-7454-47a3-bc06-821cdf136460", reason: "Settled by Tide 101: the Undertow, then the Age of the Veil, then the Era of Verdancy and the Tide." },
  { id: "8fd756a2-5aa4-4522-b6c3-aad04214aa45", reason: "Settled by Tide 101: the Undertow, then the Age of the Veil, then the Era of Verdancy and the Tide." },
];
