import { AppShell } from "@/components/shell/AppShell";
import { requirePageContext } from "@/lib/server/page-context";

// Private, per-user data: always rendered on request, never statically cached.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageContext();
  return (
    <AppShell mode={ctx.mode} actorLabel={ctx.actor.label} canEdit={ctx.canEdit}>
      {children}
    </AppShell>
  );
}
