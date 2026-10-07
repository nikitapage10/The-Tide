/** POST /api/v1/demo/reset — demo mode only: restore the seeded fixtures. */
import { DomainError } from "@/lib/domain/errors";
import { gmMutation } from "@/lib/server/api";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { ctx } = await gmMutation(req);
  if (ctx.mode !== "demo") throw new DomainError("FORBIDDEN", "Reset is only available in local demo mode.");
  const { resetDemoStore } = await import("@/lib/data/demo-file-store");
  await resetDemoStore();
  return json({ reset: true });
});
