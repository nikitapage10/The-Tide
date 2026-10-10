/**
 * The C.E.O. desk: where the Tide meets the C.E.O. (Command Everything,
 * Obviously), the GM's office of AI agents. The Tide is its Archive room;
 * this page shows who works there and the work orders the Tide's own state
 * gives them, the same list the C.E.O. reads from the work-orders endpoint.
 */
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Notice } from "@/components/ui/States";
import { publicScope } from "@/lib/domain/audience";
import { ARCHIVE_AGENTS, workOrders, type AgentId, type WorkOrder } from "@/lib/domain/work-orders";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "C.E.O. desk" };

const CEO_URL = "https://command-everything-obviously.vercel.app/";
const KIND: Record<WorkOrder["kind"], string> = {
  "settle-question": "Settle",
  "write-entry": "Write",
  "commission-art": "Art",
  "prep-session": "Session",
  "prep-item": "Prep",
};

export default async function CeoDeskPage() {
  const ctx = await requirePageContext();
  const closed = ctx.audience !== "gm" && publicScope() === "tiered";
  const [state, checklist, sessions] = closed
    ? [null, [], []]
    : await Promise.all([ctx.publicationStore.getActiveState(), ctx.operationalStore.listChecklistItems(), ctx.operationalStore.listSessionStates()]);
  const orders = state ? workOrders(state, checklist, sessions) : [];
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "The Workshop" }]}
        title="C.E.O. desk"
        description="The Tide is the Archive in the C.E.O. (Command Everything, Obviously), the GM's office of AI agents. Here are the agents who work on it, and the jobs the Tide itself gives them."
      />
      <p className="mb-12">
        <a href={CEO_URL} target="_blank" rel="noopener noreferrer" className="tracked text-[0.62rem]">
          Open the C.E.O. →<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>

      {closed ? (
        <Notice title="The GM's desk">Sign in as the GM to see the work orders.</Notice>
      ) : (
        <>
          {/* Who works in the Archive. */}
          <section aria-labelledby="agents-h" className="mb-16">
            <h2 id="agents-h" className="t-display-m mb-6">
              In the Archive
            </h2>
            <ul className="grid gap-px overflow-hidden bg-white/[0.07] md:grid-cols-2">
              {(Object.keys(ARCHIVE_AGENTS) as AgentId[]).map((id) => {
                const a = ARCHIVE_AGENTS[id];
                const mine = orders.filter((o) => o.agent === id).length;
                return (
                  <li key={id} className="bg-bg p-6">
                    <p className="flex items-baseline justify-between gap-4">
                      <span className="t-title">{a.name}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[0.62rem] text-faint">{mine} open</span>
                    </p>
                    <p className="tracked mt-1 text-[0.56rem] text-faint">
                      {a.role} · {a.provider}
                    </p>
                    <p className="mt-3 text-sm text-muted">{a.bio}</p>
                    <p className="mt-3 font-[family-name:var(--font-display)] italic text-text">&ldquo;{a.catchphrase}&rdquo;</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* The work orders. */}
          <section aria-labelledby="orders-h" className="mb-16">
            <h2 id="orders-h" className="t-display-m mb-2">
              Work orders
            </h2>
            <p className="mb-6 max-w-2xl text-sm text-muted">Read from the published lore and the live prep: questions to settle, entries still unwritten, portraits missing, the next session and its checklist. They clear themselves as the work is published or ticked off.</p>
            {orders.length ? (
              <ol className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                {orders.map((o) => (
                  <li key={o.id} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[6rem_minmax(0,1fr)_8rem]">
                    <span className="flex items-center gap-2">
                      <Badge tone={o.priority === "high" ? "warn" : undefined}>{KIND[o.kind]}</Badge>
                    </span>
                    <span className="min-w-0">
                      {o.href ? (
                        <Link href={o.href} className="t-title block text-text no-underline hover:text-white">
                          {o.title}
                        </Link>
                      ) : (
                        <span className="t-title block">{o.title}</span>
                      )}
                      {o.detail ? <span className="mt-1 block text-sm text-muted">{o.detail}</span> : null}
                    </span>
                    <span className="tracked text-[0.56rem] text-faint sm:text-right">{ARCHIVE_AGENTS[o.agent].name}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nothing for the Archive right now.">Every question is settled and every entry written.</EmptyState>
            )}
          </section>

          {/* How the C.E.O. connects. */}
          <section aria-labelledby="wire-h" className="mb-12 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 id="wire-h" className="t-display-m mb-3">
                The wire
              </h2>
              <p className="text-sm text-muted">
                The C.E.O. reads these same work orders, so the Archive works on the Tide&rsquo;s real jobs instead of invented ones. It signs in with the machine publisher&rsquo;s key, like the ChatGPT publisher, and can only read.
              </p>
              <pre className="mt-4 overflow-x-auto border border-white/10 p-4 font-[family-name:var(--font-mono)] text-xs text-muted">
                {`GET /api/v1/workshop/work-orders
Authorization: Bearer <machine publisher key>`}
              </pre>
            </div>
            <div>
              <h2 className="t-display-m mb-3">Publishing stays approved</h2>
              <p className="text-sm text-muted">
                When the Loremaster has a release ready, the C.E.O. asks for approval (<code>lore.publish</code>). Once approved it goes through the Tide&rsquo;s own preview and validation, like every release, and can be rolled back in <Link href="/workshop/publishing">Publishing</Link>.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
