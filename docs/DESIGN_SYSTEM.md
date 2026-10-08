# The Tide: design system

This document is the design schema for everything on the site: the principles, the tokens, the motion grammar, the shared components, and what each section is. When something new is built, it should read as part of the same world as the home hero.

## Principles

1. **Things arrive; they don't appear.**
   - Text decodes from the Tide's script into English (`Decode`).
   - Images and blocks come up out of the dark (`Reveal`).
   - Objects drift in from the edges.
   - Nothing pops.
2. **Forces, not decoration.** Every motion has a cause the world would recognise, echoing the Three Consequences:
   - a current or swell (the Drowning)
   - gravity and lensing (the Divergence)
   - things arriving from elsewhere (the Drift)
3. **Quiet by default.**
   - The palette is near-black and white light.
   - Allow one focal effect per view.
   - Colour appears only where the subject owns it, such as a people's own glow.
   - Lore stays vague; summaries suggest, and the documents hold the detail.
4. **Honest uncertainty.** How settled something is shows in the drawing itself (`CanonMark`, callout leaders):
   - Confirmed is a solid stroke.
   - Provisional is dashed.
   - Unverified is dotted.
   - Contradictions are recorded as open questions, shown to the GM only.
5. **Each section is an instrument**, not a database view:

   | Section | Is a… | It feels like |
   | --- | --- | --- |
   | World | atlas | maps, an era band, a timeline river, phenomena you can watch |
   | People | gallery | portrait plates lit by each people's colour; long folios in the documents' own template |
   | Stories | library | a shelf; title pages; a serif reading measure with a dropped capital |
   | Studio | light table | pinned work in stages, from loose inspiration to framed finals |
   | Workshop | workbench | tools on the wall, the press, machines and their queues (GM only) |

6. **The name is Ilyr.** The world is Ilyr (ih-LEER, /ɪˈliːr/), from the Teruānga for "light that remains"; the adjective is Ilyrian. `WorldName` shows it decoding out of the script, with the pronunciation and meaning as its tooltip. The old working name ("Primus", "Primal") is replaced with Ilyr/Ilyrian wherever it still turns up.

## Tokens (`src/app/globals.css`)

- **Base palette.**
  - `--bg` #050506, the `--surface*` steps and `--border*` hairlines.
  - Text: `--text`, `--muted`, `--faint`, all at AA contrast or better.
  - `--accent` is cool silver.
  - Never use pure grey: neutrals lean cool.
- **Section tint.** `[data-section="world|people|stories|studio|workshop"]` sets `--tint` (an HSL triple), a faint hue used by `.tint-wash`, `.tint-text`, `.tint-rule` and the rail. The tints are:
  - World: cool slate
  - People: warm bone
  - Stories: ink and paper
  - Studio: light-table grey
  - Workshop: oxidised steel
- **People palettes.** Each people's record carries `palette` (hex). Pages pass it as `--plate-glow` / `--accent-glow`. It is used only as a low glow, never as fills or text.

  | People | Palette |
  | --- | --- |
  | Nyth'rok | frost (#b9c7d6) |
  | Obscarron | ember (#d0703a) |
  | Teruānga | dim bioluminescent yellow (#c8a84a) |
  | Umbrasa | neon breath (#8fcfc4) |
  | Resonara | pearl (#e6e1d6) |
  | Enclaves | rust and salt (#a68a72) |
- **Type.**
  - Display: Cormorant Garamond, light weights, generous tracking on titles.
  - Labels: IBM Plex Mono, uppercase, tracked (`.tracked`, `.eyebrow`).
  - UI body: system sans.
  - The scale: `.t-display-xl`, `.t-display-l`, `.t-display-m`, `.t-title`, `.t-lede`, body, caption, label.
  - Reading text is `.reading`: serif, 1.22rem, line-height 1.75, a 64ch measure. Add `.drop-cap` for a dropped capital.
- **Lines and objects.**
  - Hairlines are 1px at white 6–25%. `--radius` is 3px.
  - Bordered boxes ("cards") are only for things that really are objects: a print job, a release, a session. They are not a default container.

## Motion grammar (`src/components/motion/`)

| Piece | What it does |
| --- | --- |
| `useScrollProgress(ref, { mode })` | Writes a 0..1 progress to a CSS variable (`--p`). `track` measures a tall sticky scene; `cross` measures an element crossing the viewport. It is the same mechanism as the hero. |
| `<Reveal>` | Content rises out of the dark once, as it enters the view. `decode="…"` decodes a heading instead. |
| `<Drift>` | Slow parallax against the scroll. |
| `CalloutFx` (`components/home`) | Particle emphasis. Use at most one per view. |

Everything honours `prefers-reduced-motion` (it shows at once, with no movement) and works without JavaScript. Text is always in the HTML.

## Shared components (`src/components/tide/`)

| Component | Use |
| --- | --- |
| `Callout` | The universal annotation: a ringed point, a hairline leader, a decoding label. Place it on maps, plates and timelines (`x`, `y` in %), or inline. Its leader is drawn by canon status. |
| `WorldName`, `WorldText` | The world's name, decoding from the script. `WorldText` renders any title, summary or label with the old working name replaced by Ilyr; `Markdown` does this automatically. |
| `ArtSigil`, `src/lib/art.ts` | The painted art (docs/ART_BRIEF.md), cut by `scripts/build-art.py` into `public/art`. Ask `lib/art` by meaning (`roomSigil`, `monolith`, `homeland`, `phenomenon`...), never by path. `SectionIntro` takes `backdrop` and `numerals`; `Plate` falls back to the Unknowns. |
| `CanonMark` | A short rule drawn by canon status (solid, dashed, dotted). |
| `EraBand` | The long history in one strip, with the current era lit. |
| `ConsequenceSigil` | The marks of the Drowning, the Divergence and the Drift. |
| `Plate` | An image held in the dark, lit by its subject's palette, with a museum caption. It falls back to `ProceduralMark`. |
| `SectionRail` | The table of contents for long folios; it marks the section being read. |

These are reused from before:
- `Decode` and `TideGlyph` (the script)
- `PageHeader`
- `Markdown`, which is sanitised and renames the old working name to Ilyr
- `SmokyButton`
- `ProceduralMark`
- the hero (`HeroScene`, `HeroDrifters`) and its sound (`heroSound`)

## Content shape (what the pages expect)

- **Long entries** (peoples, enclaves) are written in the documents' template, with `##` headings: Origins, the Age of the (Abyssal) Veil, Impact of the Tide's Three Consequences, … Today, Anatomy, Behavior, Unique Abilities, Reproduction, Habitat. Enclaves use About and History. `lib/domain/body-sections.ts` splits a body into these sections and labels them for the rail.
- **Eras.** `era` places an entry on the era band. `chronology.sortKey` orders it on the timeline (B.U. years, continuing upward through the Veil and Verdancy).
- **Places.** `location` puts a place on the atlas. Without it, the place is listed as uncharted.
- **Imagery.** Media with `role: "portrait"` (or hero, map, emblem, gallery) linked to an entry supply its imagery.
- **Audiences.** `visibility` (`gm_only`, `player_safe`, `public`) decides who sees a record when tiered viewing is on.

## Accessibility and performance

- Every decoded label has its English text for screen readers; the world's name reads "Ilyr".
- Motion is decorative only: nothing important is conveyed by movement alone.
- WebGL stays on the home page. Other sections use CSS, SVG and small canvases, and pause when off-screen.
- Pages keep a 16px minimum gutter and never scroll sideways at phone width.
