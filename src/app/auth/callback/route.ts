/** GET /auth/callback — exchanges the Supabase auth code for a session cookie. */
import { NextResponse } from "next/server";
import { resolveMode } from "@/lib/server/config";
import { createUserClient } from "@/lib/server/supabase";

export async function GET(req: Request) {
  const info = resolveMode();
  const url = new URL(req.url);
  if (info.mode !== "supabase") return NextResponse.redirect(new URL("/setup", url.origin));
  const code = url.searchParams.get("code");
  if (code) {
    const db = await createUserClient(info.supabaseUrl, info.supabaseKey);
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
