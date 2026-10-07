/** POST /auth/signout — same-origin form post only. */
import { NextResponse } from "next/server";
import { resolveMode } from "@/lib/server/config";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
import { createUserClient } from "@/lib/server/supabase";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    return errorResponse(e);
  }
  const info = resolveMode();
  if (info.mode === "supabase") {
    const db = await createUserClient(info.supabaseUrl, info.supabaseKey);
    await db.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
