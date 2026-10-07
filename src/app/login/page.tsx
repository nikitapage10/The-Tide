import { redirect } from "next/navigation";
import { Plain } from "@/components/shell/Plain";
import { resolveMode } from "@/lib/server/config";
import { getAppContext } from "@/lib/server/context";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const info = resolveMode();
  if (info.mode === "setup-required") redirect("/setup");
  if (info.mode === "demo") redirect("/");
  const ctx = await getAppContext();
  if (ctx.status === "ok") redirect("/");
  return (
    <Plain title="Sign in">
      <p>The Tide is private. Sign in with the email address of a project GM.</p>
      <LoginForm url={info.supabaseUrl} publishableKey={info.supabaseKey} />
    </Plain>
  );
}
