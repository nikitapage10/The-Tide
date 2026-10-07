import Link from "next/link";
import { PrintCard } from "@/components/live/PrintCard";
import { PrintJobDialog } from "@/components/live/PrintJobForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { linkOptions } from "@/lib/domain/link-options";
import { PRINT_STATUSES } from "@/lib/domain/types";
import { requirePageContext } from "@/lib/server/page-context";
import { one, type SearchParams } from "@/lib/server/params";
import { cx } from "@/components/ui/cx";

export const metadata = { title: "Print queue" };
const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 } as const;

export default async function PrintsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePageContext();
  const status = one((await searchParams).status);
  const [jobs, state] = await Promise.all([ctx.operationalStore.listPrintJobs(), ctx.publicationStore.getActiveState()]);
  const visible = jobs
    .filter((j) => (status ? j.status === status : !["complete", "canceled"].includes(j.status)))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title));
  const filters = [{ key: "", label: "Open" }, ...PRINT_STATUSES.map((s) => ({ key: s, label: s.replace("_", "-") }))];
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop", label: "The Workshop" }]}
        title="Print queue"
        description="Links and metadata for 3D prints. Retries and reprints are recorded as attempts and never change the requested quantity."
        actions={<PrintJobDialog linkOptions={linkOptions(state)} triggerLabel="New print job" />}
      />
      <nav aria-label="Filter by status" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <li key={f.key}>
              <Link
                href={f.key ? `/workshop/prints?status=${f.key}` : "/workshop/prints"}
                aria-current={status === f.key ? "page" : undefined}
                className={cx("inline-block rounded-full border px-3 py-1 text-sm no-underline", status === f.key ? "border-accent text-accent-strong" : "border-border text-muted hover:text-text")}
              >
                {f.label} ({f.key ? jobs.filter((j) => j.status === f.key).length : jobs.filter((j) => !["complete", "canceled"].includes(j.status)).length})
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {visible.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((j) => (
            <PrintCard key={j.id} job={j} />
          ))}
        </ul>
      ) : (
        <EmptyState title={jobs.length ? "No print jobs with this status." : "The print queue is empty."}>{jobs.length ? "Choose another filter above." : "Create a print job to start tracking it."}</EmptyState>
      )}
    </>
  );
}
