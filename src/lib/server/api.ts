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
  const machine = hasBearer(req);
  const ctx = machine ? await requireMachinePublisherContext(req) : (assertSameOrigin(req), await requireApiContext());
  if (!ctx.canEdit) throw new DomainError("UNAUTHENTICATED", "Sign in as the GM to validate or publish.");
  if (machine) machineRateLimit();
  const { value, text } = await readJson(req, LIMITS.maxBundleBytes);
  if (machine) assertMachineOperations(value);
  return { ctx, text };
}

/** Read-only endpoints for the machine publisher (or the GM): bearer or session. */
export async function readerRequest(req: Request): Promise<AppContext> {
  const ctx = hasBearer(req) ? await requireMachinePublisherContext(req) : await requireApiContext();
  if (!ctx.canEdit) throw new DomainError("UNAUTHENTICATED", "Sign in as the GM.");
  return ctx;
}

/**
 * Automatic publishing may add, change, archive and restore, but never
 * tombstone: permanent deletion stays a deliberate GM action.
 */
export function assertMachineOperations(bundle: unknown): void {
  const ops = (bundle as { operations?: unknown })?.operations;
  if (!Array.isArray(ops)) return; // the validator reports the shape problem
  if (ops.some((o) => (o as { op?: unknown })?.op === "tombstone")) {
    throw new DomainError("FORBIDDEN", "The machine publisher cannot tombstone records. Archive instead, or ask the GM.");
  }
}

/** A soft per-instance limit on machine requests (a runaway assistant loop, not an attacker). */
const machineHits: number[] = [];
export const MACHINE_LIMIT = { windowMs: 10 * 60 * 1000, max: 60 };
export function machineRateLimit(now = Date.now()): void {
  while (machineHits.length && now - machineHits[0]! > MACHINE_LIMIT.windowMs) machineHits.shift();
  if (machineHits.length >= MACHINE_LIMIT.max) {
    throw new DomainError("RATE_LIMITED", "Too many publishing requests; try again in a few minutes.");
  }
  machineHits.push(now);
}
