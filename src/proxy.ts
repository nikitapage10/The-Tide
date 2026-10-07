/**
 * Refreshes the Supabase auth session cookie on navigation (supabase mode only).
 * Authorization is NOT decided here; every page and API route re-checks the
 * user and GM membership on the server.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKeyFrom, supabaseUrlFrom } from "@/lib/server/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (process.env.TIDE_DATA_MODE === "demo") return response;
  const url = supabaseUrlFrom(process.env);
  const key = supabaseKeyFrom(process.env);
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/publications).*)"],
};
