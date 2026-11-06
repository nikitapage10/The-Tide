import "server-only";
import { redirect } from "next/navigation";
import { ensureLore } from "./auto-lore";
import { getAppContext, type AppContext } from "./context";

/** For pages: redirects to /setup, /login or /forbidden when access is not possible. */
export async function requirePageContext(): Promise<AppContext> {
  const result = await getAppContext();
  if (result.status === "setup-required") redirect("/setup");
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "forbidden") redirect("/forbidden");
  // A live site that lacks the lore from the GM's documents publishes it (once).
  await ensureLore(result.ctx);
  return result.ctx;
}

/** Private authoring tools are never available through the public preview. */
export async function requireGmPageContext(): Promise<AppContext> {
  const ctx = await requirePageContext();
  if (!ctx.canEdit) redirect("/login");
  return ctx;
}
