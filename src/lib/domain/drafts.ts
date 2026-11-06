import { z } from "zod";
import ids from "@fixtures/ids.json";
import {
  zEntity,
  zStory,
  zId,
  type PublishedRecord,
  type EntityRecord,
  type StoryRecord,
} from "@/lib/contract/schema";
import type { GmNote, PublishedState, Actor } from "./types";
import type { OperationalStore } from "./ports";
import type { OperationsService } from "./operations";
import { DomainError } from "./errors";
export const WORKING_DRAFT_TAG = "working draft";
export type WorkingDraft = EntityRecord | StoryRecord;
const PREFIX = "TIDE_PRIVATE_DRAFT_V1\n",
  COMMENT = "TIDE_PRIVATE_DRAFT_COMMENT_V1\n";
export function isWorkingDraft(
  r: PublishedRecord | null | undefined,
): r is WorkingDraft {
  return Boolean(
    r &&
    (r.type === "entity" || r.type === "story") &&
    r.tags?.includes(WORKING_DRAFT_TAG) &&
    r.visibility === "gm_only",
  );
}
export interface DraftVersion {
  record: WorkingDraft;
  versionId: string;
  parentVersionId: string | null;
  createdAt: string;
  authorLabel: string;
}
export function isDraftNote(body: string) {
  return body.startsWith(PREFIX) || body.startsWith(COMMENT);
}
export function draftVersions(notes: GmNote[]): DraftVersion[] {
  return notes
    .flatMap((n) => {
      if (!n.body.startsWith(PREFIX)) return [];
      try {
        const v = JSON.parse(n.body.slice(PREFIX.length));
        if (!isWorkingDraft(v.record)) return [];
        return [
          {
            ...v,
            versionId: n.id,
            createdAt: n.createdAt,
            authorLabel: n.authorLabel,
          } as DraftVersion,
        ];
      } catch {
        return [];
      }
    })
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        b.versionId.localeCompare(a.versionId),
    );
}
export function draftComments(notes: GmNote[], id: string) {
  return notes.flatMap((n) => {
    if (!n.body.startsWith(COMMENT)) return [];
    try {
      const c = JSON.parse(n.body.slice(COMMENT.length));
      return c.draftId === id && typeof c.body === "string"
        ? [{ ...n, body: c.body }]
        : [];
    } catch {
      return [];
    }
  });
}
export function workingDrafts(
  state: PublishedState,
  notes: GmNote[],
): WorkingDraft[] {
  const all = new Map<string, WorkingDraft>();
  const versions = draftVersions(notes);
  const parents = new Set(versions.map((v) => v.parentVersionId));
  for (const v of versions.filter((v) => !parents.has(v.versionId)))
    if (!all.has(v.record.id)) all.set(v.record.id, v.record);
  for (const s of Object.values(state.records))
    if (s.lifecycle === "active" && isWorkingDraft(s.record) && !all.has(s.id))
      all.set(s.id, s.record);
  return [...all.values()];
}
export function draftSubject(state: PublishedState): string {
  const candidate = state.records[ids.ids.world];
  const world = candidate?.lifecycle === "active" && candidate.record?.type === "entity" ? candidate : null;
  if (!world)
    throw new DomainError(
      "SETUP_REQUIRED",
      "Publish the Ilyr world entry before saving working drafts.",
    );
  return world.id;
}
const saveInput = z.strictObject({
  action: z.literal("save"),
  record: z.union([zEntity, zStory]),
  parentVersionId: zId.nullable(),
});
const commentInput = z.strictObject({
  action: z.literal("comment"),
  draftId: zId,
  body: z.string().trim().min(1).max(7000),
});
/** All draft text lives in the existing GM-only append-only table, not published lore. */
export async function writeDraft(
  input: unknown,
  ctx: {
    state: PublishedState;
    store: OperationalStore;
    operations: OperationsService;
    actor: Actor;
  },
) {
  const parsed = z.union([saveInput, commentInput]).safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      "INVALID_INPUT",
      "Check the draft fields and try again.",
    );
  const subjectId = draftSubject(ctx.state),
    notes = await ctx.store.listGmNotes(subjectId),
    versions = draftVersions(notes),
    data = parsed.data;
  if (data.action === "comment") {
    if (!workingDrafts(ctx.state, notes).some((r) => r.id === data.draftId))
      throw new DomainError("NOT_FOUND", "Draft not found.");
    const note = await ctx.operations.addGmNote(
      {
        subjectId,
        body:
          COMMENT + JSON.stringify({ draftId: data.draftId, body: data.body }),
      },
      ctx.actor,
    );
    return { noteId: note.id };
  }
  if (!isWorkingDraft(data.record) || data.record.canonStatus !== "unverified")
    throw new DomainError(
      "INVALID_INPUT",
      "Working drafts must remain GM-only and unverified.",
    );
  const original = ctx.state.records[data.record.id]?.record;
  if (original && !isWorkingDraft(original))
    throw new DomainError(
      "INVALID_INPUT",
      "Create a separate working draft rather than overwriting a source entry.",
    );
  const same = versions.filter((v) => v.record.id === data.record.id);
  const parents = new Set(same.map((v) => v.parentVersionId));
  const current = same.find((v) => !parents.has(v.versionId));
  if ((current?.versionId ?? null) !== data.parentVersionId)
    throw new DomainError(
      "REVISION_CONFLICT",
      "This draft changed elsewhere. Copy your text before reloading; previous versions remain available.",
    );
  const body =
    PREFIX +
    JSON.stringify({
      record: data.record,
      parentVersionId: data.parentVersionId,
    });
  if (body.length > 10000)
    throw new DomainError(
      "INVALID_INPUT",
      "Keep this draft under 10,000 characters including its title and summary. Split longer writing into separate drafts.",
    );
  const note = await ctx.operations.addGmNote({ subjectId, body }, ctx.actor);
  return { draftId: data.record.id, versionId: note.id };
}
