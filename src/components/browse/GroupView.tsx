/**
 * Which room each sub-page is: one designed view per group, under a shared
 * opening (GroupHero). Filtering (?q=, ?tag=, ...) still falls back to the
 * plain, searchable list (EntityBrowser / StudioBrowser).
 */
import type { ComponentType } from "react";
import type { EntityRecord, MediaRecord, StoryRecord } from "@/lib/contract/schema";
import { listRecords, type Listed } from "@/lib/domain/queries";
import { PEOPLE_KIND_GROUPS, STORY_FORMAT_GROUPS, STUDIO_TYPE_GROUPS, WORLD_KIND_GROUPS } from "@/lib/domain/sections";
import type { PublishedState } from "@/lib/domain/types";
import { GroupHero } from "./GroupHero";
import * as P from "./people";
import * as S from "./stories";
import * as St from "./studio";
import * as W from "./world";

type View<T extends EntityRecord | StoryRecord | MediaRecord> = ComponentType<{ state: PublishedState; items: Listed<T>[] }>;

const WORLD: Record<string, View<EntityRecord>> = {
  environments: W.Environments,
  places: W.Places,
  history: W.History,
  technology: W.Technology,
  relics: W.Relics,
  phenomena: W.Phenomena,
  workings: W.Workings,
  concepts: W.Concepts,
};
const PEOPLE: Record<string, View<EntityRecord>> = {
  peoples: P.Peoples,
  characters: P.Characters,
  creatures: P.Creatures,
  factions: P.Factions,
  institutions: P.Institutions,
};
const STORIES: Record<string, View<StoryRecord>> = {
  campaigns: S.Campaigns,
  "one-shots": S.OneShots,
  novels: S.Novels,
  "short-fiction": S.ShortFiction,
};
const STUDIO: Record<string, View<MediaRecord>> = {
  music: St.Music,
  artwork: St.Artwork,
  elements: St.Elements,
  aesthetics: St.Aesthetics,
  branding: St.Branding,
  other: St.Other,
};

const pad = (n: number) => String(n).padStart(2, "0");

export function hasGroupView(section: "world" | "people" | "stories" | "studio", group: string) {
  return !!{ world: WORLD, people: PEOPLE, stories: STORIES, studio: STUDIO }[section][group];
}

export function GroupView({ state, section, group }: { state: PublishedState; section: "world" | "people" | "stories" | "studio"; group: string }) {
  if (section === "world" || section === "people") {
    const groups = section === "world" ? WORLD_KIND_GROUPS : PEOPLE_KIND_GROUPS;
    const g = groups[group]!;
    const View = (section === "world" ? WORLD : PEOPLE)[group]!;
    const items = listRecords(state, "entity").filter((e) => g.kinds.includes(e.record.kind));
    const at = Object.keys(groups).indexOf(group) + 1;
    return (
      <div data-section={section} data-room={group}>
        <GroupHero
          section={section === "world" ? "The World" : "People"}
          sectionHref={`/${section}`}
          index={`${section === "world" ? "01" : "02"}.${pad(at)}`}
          title={g.label}
          description={g.description}
          count={items.length}
          noun={["entry", "entries"]}
          listHref={`/${section}?status=active${g.kinds.length === 1 ? `&kind=${g.kinds[0]}` : ""}`}
        />
        <View state={state} items={items} />
      </div>
    );
  }
  if (section === "stories") {
    const g = STORY_FORMAT_GROUPS[group]!;
    const View = STORIES[group]!;
    const items = listRecords(state, "story").filter((s) => g.formats.includes(s.record.format));
    return (
      <div data-section="stories" data-room={group}>
        <GroupHero section="The Library" sectionHref="/stories" index={`03.${pad(Object.keys(STORY_FORMAT_GROUPS).indexOf(group) + 1)}`} title={g.label} description={g.description} count={items.length} noun={["story", "stories"]} />
        <View state={state} items={items} />
      </div>
    );
  }
  const g = STUDIO_TYPE_GROUPS[group]!;
  const View = STUDIO[group]!;
  const items = listRecords(state, "media").filter((m) => g.types.includes(m.record.mediaType));
  return (
    <div data-section="studio" data-room={group}>
      <GroupHero
        section="The Studio"
        sectionHref="/studio"
        index={`04.${pad(Object.keys(STUDIO_TYPE_GROUPS).indexOf(group) + 1)}`}
        title={g.label}
        description={g.description}
        count={items.length}
        noun={["item", "items"]}
        listHref={`/studio?status=active${g.types.length === 1 ? `&type=${g.types[0]}` : ""}`}
      />
      <View state={state} items={items} />
    </div>
  );
}
