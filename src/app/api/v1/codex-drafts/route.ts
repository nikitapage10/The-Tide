import { gmMutation, readerRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";
import {
  draftSubject,
  draftVersions,
  workingDrafts,
  writeDraft,
} from "@/lib/domain/drafts";
export const GET = route(async (req) => {
  const ctx = await readerRequest(req);
  const state = await ctx.publicationStore.getActiveState();
  const notes = await ctx.operationalStore.listGmNotes(draftSubject(state));
  return json({
    drafts: workingDrafts(state, notes),
    versions: draftVersions(notes),
  });
});
export const POST = route(async (req) => {
  const { ctx, body } = await gmMutation(req);
  return json(
    await writeDraft(body, {
      state: await ctx.publicationStore.getActiveState(),
      store: ctx.operationalStore,
      operations: ctx.operations,
      actor: ctx.actor,
    }),
    201,
  );
});
