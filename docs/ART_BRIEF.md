# Art brief: the Arrival image, and the asset list for the redesign

## Context
- **Arrival is empty.** After the hero, the scroll story's first chapter, "Arrival", is text on near-black. The hero has a full painted scene behind it, so Arrival feels empty next to it. The user wants a prompt to generate an image for it.
- **They also want a list of every other asset to make.** The redesigned sections (story chapters, World, People, Stories, Studio, Workshop) currently get by on procedural drawing.

Once the files arrive, I will place each one in `public/` and wire it in, then publish the matching `media` records for the lore images.

## House style (applies to every prompt below)
- **Colour:** near-monochrome, cool silver-grey on deep black (#050506), soft film grain, with one faint cool light source. Colour appears only where a subject owns it (for example, a people's glow), kept low and desaturated.
- **Look:** cinematic, painterly realism like the hero planet: soft focus at the edges, atmospheric haze, quiet. Nothing busy or neon.
- **Leave room for text.** Keep the left 40% of the frame dark and empty, because text sits over it on the site.
- **No lettering, logos, UI or frames.** The world's name is never written.
- **Format:** 16:9, at least 2400×1350, delivered as PNG or high-quality JPG. I convert to WebP. Transparent PNG only where noted.

## 1. Arrival (the prompt to use now)
**File:** `story-arrival.png`, 2400×1350 (16:9). It sits under the text "Breathe, little spark… you have washed upon the shores of ███…".

> A lone, small human figure (seen from behind, far away, tiny in the frame) standing at the edge of a black, glassy shoreline at night, just arrived and disoriented. The sea is calm and dark, with a thin line of pale foam. Above the horizon, enormous and close, the curved limb of a cloud-wrapped planet-sized world fills the upper right of the sky, lit from behind with a silver rim. Fragments of land, floating mountains with trailing mist, hang in the sky near the horizon, tiny with distance. A faint shimmer in the air around the figure, like a heat-haze tear in reality, the rift it came through, already closing. Sea mist drifting low. The left 40% of the image is open dark sky and sea, almost empty. Cinematic, painterly realism, monochrome cool silver and graphite on deep black, soft film grain, very low saturation, one cold light from behind the planet, quiet and vast, a sense of wrongness and wonder. No text, no logo.

**Negative / avoid:** bright colours, neon, sunset orange, multiple figures, sci-fi UI, lens flares, text, watermark, busy detail on the left.

**Alternate, if a figure feels too literal:** the same shoreline and sky with only a single set of footprints leading out of the shimmering rift in the mist.

## 2. The other story chapters (16:9, 2400×1350, left 40% dark)
| Chapter | File | Prompt essence |
| --- | --- | --- |
| II · Before | `story-before.png` | A near-future coastal city at dusk seen from the sea, its towers and turbines silhouetted. On the horizon, a vast dark wall of water and storm rising, with gravity-bent clouds spiralling upward. The last calm moment before the Undertow. |
| III · The Veil | `story-veil.png` | Fog-filled ruins of drowned cities, half-sunk. In the gloom, faint silhouettes of transformed beings in stasis, fused with stone, coral or ice. A long twilight, dreamlike and very dark. |
| IV · Verdancy | `story-verdancy.png` | Tall sea cliffs of a lush, glowing green island at night. In the dark water below, five small shelled swimmers with ember-like markings carry a pale, unconscious girl toward the shore. Hopeful, tender, still monochrome with one warm glint. |
| V · The Tide | `story-tide.png` | The planet's horizon in upheaval: coastline drowning, chunks of land tearing loose and rising into the sky, and a lens-like distortion of light. A rift opening, with fragments of another time (a ship's mast, a ruined tower) drifting through. |

## 3. The peoples (People hall, folios, home procession)
**Format:** 3:4 portrait, at least 1200×1600, subject centred, dark background, with a little headroom.

- **Have:** Nyth'rok, Obscarron, Teruānga, Umbrasa and Resonara, from the documents.
- **Need portraits for:**
  - **Irridosai:** pale, radiant people of a lush, radioactive island of cliffs. A faint inner glow and a sickly-bright jungle behind.
  - **Blightmourn:** a people of harsh deserts, storm-scoured, ozone-tasting dust storms.
  - **Syntherion:** to be decided once written. Please give me a one-line description and I'll write the prompt.
- **Optional:** a second, wider "hero" image per people, 16:9, showing their homeland, for the top of each folio:
  - Nyth'rok: Stillholds with shadows burned onto the walls.
  - Obscarron: Molten Cities with lava rivers.
  - Teruānga: coral and volcanic cities in the abyss.
  - Umbrasa: moon shards around the black hole.
  - Resonara: Eden-like fibre forest swallowed by fog.

## 4. The Arrivals (enclaves): 4:3 landscape, at least 1600×1200
- `enclave-normandy.png`: a coastal settlement of salvaged hulls and cobblestones under a silver moon, with flags of several nations.
- `enclave-conquistadors.png`: armoured men hiding in obsidian tunnels, lit by lava glow.
- `enclave-pirates.png`: an old sailing ship in a fog bank where the sea seems to fold.
- `enclave-armada.png`: a fleet of galleons emerging from a shimmer onto a strange ocean.

## 5. World
- **`world-map.png` (2:1 equirectangular, at least 4096×2048), the most valuable asset.** It should be greyscale, showing the drowned continents' new coastlines, inland seas and the floating-mountain regions. It needs no labels. With it, the atlas globe can show real geography and I can place locations.
  - **Alternative:** a hand-drawn regional map. Then each place needs a rough position, given as a list of place → x, y.
- **Phenomena, 1:1 at least 1200×1200, abstract and atmospheric:**
  - `phenomenon-drowning.png`
  - `phenomenon-divergence.png`
  - `phenomenon-drift.png`
  - `phenomenon-windows-of-memory.png`
  - `phenomenon-echoing-miasma.png`
- **Places, 16:9, optional:**
  - Te Ara Kore
  - the Abyssal Divide
  - the Primordial Aukar
  - the Floating Mountains
  - the Molten Cities
  - the Stillholds

## 6. Stories, Studio, Workshop
- **Stories:**
  - **A cover per story (2:3, at least 1200×1800).** The only real story now is "Arrival", which can reuse the Arrival image in portrait crop. Future campaigns and novels should each get a cover.
  - **Optionally, a paper texture for the reading view:** `paper-dark.png`, tileable, 1024×1024, a very subtle dark grain.
- **Studio:** nothing required. It shows whatever art you publish. Music: more tracks if you like, as MP3 with a title for each.
- **Workshop:** nothing required.

## 7. Sound (optional)
Short, quiet loops (MP3, 30–60 s, seamless) to play under the story chapters:
- shoreline wind (Arrival)
- deep rumble (Before)
- muffled fog drone (the Veil)
- distant surf (Verdancy)

## Delivery and wiring (after the files arrive)
- **Delivery:** drop the files in the chat with the file names above. If no name is given, I'll name them.
- **Arrival:** goes in `src/components/home/WorldStory.tsx` (Chapter 0) as a background layer under `.story-dust`, with the same dim and fade treatment as `.story-planet`. Chapters II–V follow the same pattern.
- **Portraits and lore images:** saved under `public/lore/…`, with `media` records (role `portrait`, `hero` or `map`) added to `lore/catalog.ts`. The release is rebuilt with `scripts/build-lore-bundle.ts`, so the People hall, the folios and the story procession pick them up automatically.
- **World map:** the texture goes on the globe in `src/components/world/Globe.tsx`, replacing the graticule-only body. Places get `location` values.
- **Verification:**
  - screenshot each chapter at 1280 and 390 wide;
  - check that text over each image stays readable (AA contrast);
  - rerun the e2e suite.
