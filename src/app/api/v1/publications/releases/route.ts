/** GET /api/v1/publications/releases — release history and audit events (GM only). */
import { requireApiContext } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  const ctx = await requireApiContext();
  const [project, releases, events] = await Promise.all([
    ctx.publicationStore.getProject(),
    ctx.publicationStore.listReleases(),
    ctx.publicationStore.listPublicationEvents(50),
  ]);
  return json({ activeReleaseId: project.activeReleaseId, releases, events });
});
