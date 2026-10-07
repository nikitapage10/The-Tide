import { ENTITY_KIND_LABEL } from "./sections";
import { listRecords } from "./queries";
import type { PublishedState } from "./types";

export interface LinkOptionData {
  id: string;
  title: string;
  group: string;
  demo: boolean;
}

/** Records a live item (print, build) may link to, by stable ID. */
export function linkOptions(state: PublishedState): LinkOptionData[] {
  return [
    ...listRecords(state, "session").map(({ record: r }) => ({ id: r.id, title: r.title, group: "Sessions", demo: r.demo })),
    ...listRecords(state, "story").map(({ record: r }) => ({ id: r.id, title: r.title, group: "Stories", demo: r.demo })),
    ...listRecords(state, "entity").map(({ record: r }) => ({ id: r.id, title: r.title, group: ENTITY_KIND_LABEL[r.kind], demo: r.demo })),
    ...listRecords(state, "media").map(({ record: r }) => ({ id: r.id, title: r.title, group: "Studio", demo: r.demo })),
  ];
}
