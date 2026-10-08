import { DemoResetButton } from "@/components/live/DemoResetButton";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Notice } from "@/components/ui/States";
import { configSummary } from "@/lib/server/config";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "Connection & settings" };

function Row({ label, ok, okText = "Set", missingText = "Not set" }: { label: string; ok: boolean; okText?: string; missingText?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
      <dt className="text-sm">{label}</dt>
      <dd>
        <Badge tone={ok ? "ok" : "neutral"}>{ok ? okText : missingText}</Badge>
      </dd>
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requirePageContext();
  const c = configSummary();
  const project = await ctx.publicationStore.getProject();
  return (
    <>
      <PageHeader crumbs={[{ href: "/workshop", label: "The Workshop" }]} title="Connection & settings" description="Shows what is actually configured. Nothing here is connected unless it says so." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card as="section" aria-labelledby="h-mode">
          <SectionHeading id="h-mode">Data mode</SectionHeading>
          {ctx.mode === "demo" ? (
            <Notice tone="warn" title="Demo mode (local only)">
              Data lives in a JSON file on this machine (default <code>.tide-demo/state.json</code>). It survives page refreshes and restarts of the dev server, but it is not a production database. Sign-in is bypassed with a local demo identity; this is refused in production deployments.
            </Notice>
          ) : (
            <Notice tone="ok" title="Configured: Supabase">
              Published lore and live records are read from Supabase with your signed-in session. Row Level Security limits access to project GMs.
            </Notice>
          )}
          <dl className="mt-4">
            <Row label="Project" ok okText={project.name} />
            <Row label="Active release" ok={Boolean(project.activeReleaseId)} okText={`version ${project.releaseCount}`} missingText="none" />
            <Row label="Signed in as" ok okText={ctx.actor.label} />
          </dl>
          {ctx.mode === "demo" ? (
            <div className="mt-4">
              <DemoResetButton />
            </div>
          ) : null}
        </Card>
        <Card as="section" aria-labelledby="h-integrations">
          <SectionHeading id="h-integrations">Integrations</SectionHeading>
          <dl>
            <Row label="Supabase URL (public)" ok={c.supabaseUrlSet} />
            <Row label="Supabase publishable key (public)" ok={c.publishableKeySet} />
            <Row label="Project ID" ok={c.projectIdSet} />
            <Row label="Server secret key (machine publisher only)" ok={c.serviceKeySet} />
            <Row label="Machine publisher token hash" ok={c.machinePublisherConfigured} okText="Configured" missingText="Not configured" />
            <Row label="Private asset storage" ok={ctx.mode === "supabase"} okText={`Bucket ${c.storageBucket}`} missingText="Unavailable in demo" />
            <Row label="ChatGPT publisher (custom GPT Action)" ok={c.machinePublisherConfigured && c.serviceKeySet} okText="Ready: /api/v1/openapi.json" missingText="Needs the token hash and server key (docs/CONTENT_PIPELINE.md)" />
            <Row label="Tiered viewing (GM · players · public)" ok={process.env.TIDE_PUBLIC_SCOPE === "tiered"} okText="On" missingText="Off: open preview (TIDE_PUBLIC_SCOPE=tiered to turn on)" />
            <Row label="Realtime updates" ok={false} missingText="Off (pages refetch after each change)" />
          </dl>
          <p className="mt-3 text-xs text-faint">Values are never displayed; only whether they are set.</p>
        </Card>
      </div>
    </>
  );
}
