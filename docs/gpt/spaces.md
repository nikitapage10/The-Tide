# The spaces and what they publish

| Space | Material | Record | Notes |
| --- | --- | --- | --- |
| **World** | The world itself, eras and ages | `entity` `history` (an age), `event` (a moment) | Set `era` and `chronology.sortKey`. The ages are: before the Undertow (the Shoreborn), the Undertow, the Age of the (Abyssal) Veil, the Era of Verdancy, the Tide. |
| | Places and regions | `entity` `place` / `environment` | `parentId` for nesting. Give a `location` ({ lat, lon }) only when the GM places it. |
| | Phenomena (the Drowning, the Divergence, the Drift, Windows of Memory…) | `entity` `phenomenon` | The Three Consequences already exist: reuse their IDs. |
| | Technology, relics | `entity` `technology` / `relic` | `parentId` = the people who made it, if any. |
| | How the world works (Mana/Aether, gravity…) | `entity` `world_mechanic` | |
| | Names and terms | `entity` `concept` | Glossary-like. |
| **People** | A people (Nyth'rok, Obscarron, Teruānga, Umbrasa, Resonara, Irridosai, Blightmourn, Syntherion) | `entity` `people` | The full document as `body`, in the template. `palette`. A portrait as `media` (`role: portrait`). The eight already exist: reuse their IDs. |
| | An enclave (the Normandy Enclave, the Conquistador Brotherhood…) | `entity` `people`, tag `enclave`, `era: tide` | About / History. |
| | Factions, orders, governments | `entity` `faction` / `institution` | `parentId` = the people; also a relationship "Faction of" → the people. |
| | Characters | `entity` `character` | Portrait media if any. |
| | Creatures | `entity` `creature` | |
| **Stories** | Campaigns, one-shots | `story` (`format` campaign / one_shot) | Sessions as `session` records (`storyId`, `sequence`, `recap`; `prep` is GM-only). |
| | Novels, short fiction | `story` (`format` novel / short_fiction) | Chapters and scenes as `story_part` (`storyId`, `partType`, `sequence`). The text of a short piece can be the story's `body`. |
| **Studio** | Art, music, aesthetics, branding, design | `media` | `mediaType`, `stage` (inspiration → draft → approved → final), `role` for how pages use it, `linkedIds` to what it depicts. |
| **Workshop** | Contradictions and gaps found while writing | `open_question` | Never resolve them yourself; the GM settles them in the spaces. |
| | Prints, builds, session prep | (live data, not published) | These are entered on the site itself, not through bundles. |
