/**
 * GET /api/v1/workshop/work-orders — the jobs the Tide gives the agents in
 * the C.E.O.'s Archive (questions to settle, unwritten entries, missing
 * portraits, session prep), read from the active release and the live prep.
 * Read-only. Machine publisher (bearer) or GM.
 */
import { readerRequest } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";
import { ARCHIVE_AGENTS, workOrders } from "@/lib/domain/work-orders";

export const GET = route(async (req) => {
  const ctx = await readerRequest(req);
  const [state, checklist, sessions] = await Promise.all([ctx.publicationStore.getActiveState(), ctx.operationalStore.listChecklistItems(), ctx.operationalStore.listSessionStates()]);
  return json({ projectId: ctx.projectId, activeReleaseId: state.releaseId, room: "archive", agents: ARCHIVE_AGENTS, orders: workOrders(state, checklist, sessions) });
});
