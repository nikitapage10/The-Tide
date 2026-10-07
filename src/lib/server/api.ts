import "server-only";
import { LIMITS } from "@/lib/contract/schema";
import { DomainError } from "@/lib/domain/errors";
import { requireApiContext, type AppContext } from "./context";
import { MAX_LIVE_BODY, assertSameOrigin, readJson } from "./http";
import { hasBearer, requireMachinePublisherContext } from "./publisher-auth";

/** Cookie-authenticated GM mutation: origin check → auth → JSON body. */
export async function gmMutation(req: Request, maxBytes = MAX_LIVE_BODY): Promise<{ ctx: AppContext; body: unknown }> {
  if (hasBearer(req)) throw new DomainError("FORBIDDEN", "Bearer credentials are only accepted by the publication endpoints.");
  assertSameOrigin(req);
  const ctx = await requireApiContext();
  if (!ctx.canEdit) throw new DomainError("UNAUTHENTICATED", "Sign in as the GM to make changes.");
  const { value } = await readJson(req, maxBytes);
  return { ctx, body: value };
}

/** Publication endpoints accept either a GM session (with origin check) or the machine publisher. */
export async function publisherRequest(req: Request): Promise<{ ctx: AppContext; text: string }> {
  const ctx = hasBearer(req)
    ? await requireMachinePublisherContext(req)
    : (assertSameOrigin(req), await requireApiContext());
  if (!ctx.canEdit) throw new DomainError("UNAUTHENTICATED", "Sign in as the GM to validate or publish.");
  const { text } = await readJson(req, LIMITS.maxBundleBytes);
  return { ctx, text };
}
