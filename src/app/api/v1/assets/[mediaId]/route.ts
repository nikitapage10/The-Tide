/**
 * GET /api/v1/assets/:mediaId — authorize, then redirect to a 60-second signed URL.
 * Signed URLs are generated per request and never stored or cached.
 */
import { DomainError } from "@/lib/domain/errors";
import { requireApiContext } from "@/lib/server/context";
import { route } from "@/lib/server/http";

export const GET = route(async (_req, { params }: { params: Promise<{ mediaId: string }> }) => {
  const ctx = await requireApiContext();
  const state = await ctx.publicationStore.getActiveState();
  const rs = state.records[(await params).mediaId];
  if (!rs || rs.record?.type !== "media" || !rs.record.asset) throw new DomainError("NOT_FOUND", "No private asset for this item.");
  if (!ctx.signAsset) throw new DomainError("SETUP_REQUIRED", "Private storage is not available in demo mode.");
  const url = await ctx.signAsset(rs.record.asset.bucket, rs.record.asset.path);
  if (!url) throw new DomainError("NOT_FOUND", "Asset is unavailable or you are not authorized.");
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
});
