import "server-only";
import { redirect } from "next/navigation";
import { getAppContext, type AppContext } from "./context";

/** For pages: redirects to /setup, /login or /forbidden when access is not possible. */
export async function requirePageContext(): Promise<AppContext> {
  const result = await getAppContext();
  if (result.status === "setup-required") redirect("/setup");
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "forbidden") redirect("/forbidden");
  return result.ctx;
}
