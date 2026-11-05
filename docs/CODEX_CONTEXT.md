# The Tide: continuing in Codex

Updated November 5, 2026. This is the current authoring handoff. Older README and
handoff sections describe earlier implementation stages and may be stale.

## Project and continuity

The GM is Nikita Page. This is the existing GitHub project previously developed
with Claude: `nikitapage10/The-Tide`. Continue this project rather than replacing
it with a separate application. The repository is shared through GitHub; moving
between assistants does not require moving or rebuilding the code.

Claude conversation history, account credentials, live database contents, and
hosting settings do not automatically transfer. Do not claim they were migrated.
The current session inspected the repository and worked from the attached source
pack. It did not connect to or alter a hosted Supabase database or Vercel project.

The default branch at handoff is `claude/lucid-mccarthy-493lvy`. Its name is just
a Git branch; Codex can work on it. Follow the one-branch convention in AGENTS.md.

A separate experimental prototype was started before the repository was supplied.
It was not published or integrated here. Do not use that prototype as this
project’s identity, hosting configuration, database, or source of lore.

## Current creative direction

The primary goals are:

- Run a tabletop campaign in Ilyr.
- Write short stories in the same world.
- Give other writers enough foundational knowledge to contribute without
  revealing every origin, explanation, or future discovery.

The GM has substantial pre-Tide history and wants the next work to focus on the
present: **roughly two years after the Tide’s major upheaval**. This is a working
planning anchor; conflicting chronology in older documents remains unresolved.

The next setting work should develop **one starting region and one specific
storyline**. Their names, geography, residents, factions, and opening incident
have not been chosen. A transport settlement was suggested in conversation only
as an example; it is not canon.

The GM referred to a D&D campaign. The repository calls the setting Daggerheart.
Confirm the intended rules engine when mechanics become relevant. Do not convert
or design mechanics during lore migration.

## Confirmed terminology

- Planet: **Ilyr**.
- Adjective: **Ilyan**, pronounced **ill-ee-an**. Older `Ilyrian` is superseded.
- Nine peoples: Blightmourn, Irridosai, Nyth’rok, Obscarron, Resonara,
  Syntherion, Teruānga, Umbrasa, and Humans.
- Native humans and humans arriving through the Drift are distinct experiences
  within humanity. An enclave is not an additional biological people.
- The Undertow is the older catastrophe; the Tide is the later upheaval with
  the Drowning, Divergence, and Drift. Do not merge them.
- Umbrasa: **Muunbrak** derives from **Moonbreak**; the black hole is **Hollmaw**.
  Neon breath glows under electrical excitation, not constantly.

The repository contains an older proposed Ilyr etymology and pronunciation.
The latest Tide 101 source leaves the name’s origin open. Review that difference
before treating the older explanation as confirmed; this migration did not invent
or settle a new etymology.

## Source material and release state

The current pack is `The-Tide-Ilyr-Sources-Complete(1).zip`, provided in ChatGPT.
Its 12 Word documents were converted to `lore/docs/*.md`. The import manifest at
`lore/source-manifest.json` records filenames and SHA-256 hashes of the Word files.
Existing source illustrations are used where supplied; no new portraits were
invented. This repository does not contain the original Word binaries.

`lore/docs/umbrasa-legacy.md` is explicitly a superseded draft preserved because
some existing derived institutions refer to it. It is not a thirteenth current
source. Those entries are private and unverified in the staged catalog; review
Mass-Weavers/Gravitar against the current Pathrunners/weight-shifters account.
Hollmaw keeps the existing black-hole record’s UUID; a name change does not create
a new identity.

Important files:

| Path | Role |
| --- | --- |
| `lore/docs/` | Working source text, including unresolved contradictions |
| `lore/catalog.ts` | Stable names, summaries, source mappings, relationships, and questions |
| `scripts/build-lore-docs.py` | Import the complete Word directory or ZIP |
| `scripts/build-lore-bundle.ts` | Build and validate a proposed publication bundle |
| `fixtures/publication/lore-release-next.json` | Staged complete-source release; review before publication |
| `fixtures/publication/lore-release.json` | Existing release used by the app/demo and automatic bootstrap; intentionally unchanged |

The staged release fills the Blightmourn, Irridosai, and Syntherion entries, adds
Humans, updates Umbrasa, and adds the post-Tide planning anchor and open questions.
It preserves existing record IDs. Imported text remains provisional source
material; importing it does not resolve every claim as objective truth.

## Codex/dashboard direction

The GM wants a functional codex to rediscover existing lore, search it, comment,
and develop it over time. Build this into the existing dashboard. Reuse its
visual design and current models before creating parallel infrastructure.

Already available:

- World and People entries, body sections, portraits, references and relationships.
- Global full-text search and category filters.
- Private, append-only GM notes attached to stable published record IDs.
- Stories, campaigns, session preparation and live operational records.
- Workshop publishing with validation, preview, release history and rollback.
- Memory/local-demo and Supabase adapters with audience restrictions.

Next useful increments:

1. A focused codex overview that makes the current source library easy to browse.
2. A “Two Years After” workspace for the shared present, starting region and first story.
3. Editable working drafts with recoverable revisions, kept separate from published lore.
4. Linked comments and a consolidated development notebook.
5. Separate public introduction, contributor reference, and private GM material.

Notes saved in the live app do not automatically appear in ChatGPT. GitHub access
provides repository content, not automatic access to live Supabase records.
An authenticated export/API integration would need its own verified setup.

## Questions to resolve next

- Whether major Drowning events are continuing.
- Frequency of new Drift arrivals and emerging Divergence abilities.
- Surviving power, medicine, manufacturing, weapons, travel and communications.
- Local authority, mixed communities and ordinary daily life.
- The starting settlement, nearby locations, factions and opening incident.
- Nyth’rok documents’ conflicting “today” accounts.
- The Blightmourn’s centuries-old legends following a recent Drowning.
- Which older Umbrasa institutions survive in the current account.
- Public/contributor knowledge boundaries and what writers may invent freely.

Develop details when they support a scene, a player choice, or another writer’s
ability to contribute. Keep unrelated ideas in a backlog.

## Working and publishing

Install with `npm ci`. Run `npm run demo` for local data; local demo writes survive
refreshes but are not production persistence. Use `npm run typecheck`, `npm test`,
and `npm run lint` for verification.

Import a complete source pack:

```sh
python3 scripts/build-lore-docs.py /absolute/path/to/source-pack.zip
npm run lore:prepare
```

The importer requires pandoc and Pillow. Building a bundle validates its shape;
tests also preview it against the seed and an existing lore release. Review
visibility: current sources contain detailed origins and existing catalog records
may carry older public labels. Do not publish the full source pack as a player
introduction by accident.

On an explicit request to publish, follow the existing `publish:lore` or
`publish:bundle` workflow in AGENTS.md. The publisher rebases against the live
release, validates, and records a release that can be rolled back. No production
publication was performed in this migration.
