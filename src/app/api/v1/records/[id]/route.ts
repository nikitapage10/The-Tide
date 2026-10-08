/**
 * GET /api/v1/records/{id} — one record as published in the active release,
 * in full. An upsert replaces the whole record, so the publisher reads the
 * current version before changing part of it. Machine publisher (bearer) or GM.
 */
import { DomainError } from "@/lib/domain/errors";
import { readerRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await readerRequest(req);
  const { id } = await params;
  const state = await ctx.publicationStore.getActiveState();
  const rs = state.records[id];
  if (!rs) throw new DomainError("NOT_FOUND", "No record with that ID in the active release.");
  return json({ activeReleaseId: state.releaseId, lifecycle: rs.lifecycle, record: rs.record, tombstone: rs.tombstone });
});
