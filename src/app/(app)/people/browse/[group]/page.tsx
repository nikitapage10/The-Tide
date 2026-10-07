import { BrowsePage } from "@/components/records/EntityPages";
import { requirePageContext } from "@/lib/server/page-context";
import type { SearchParams } from "@/lib/server/params";

export default async function Page({ params, searchParams }: { params: Promise<{ group: string }>; searchParams: SearchParams }) {
  return <BrowsePage ctx={await requirePageContext()} section="people" group={(await params).group} searchParams={searchParams} />;
}
