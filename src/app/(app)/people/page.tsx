import { SectionOverview } from "@/components/records/EntityPages";
import { requirePageContext } from "@/lib/server/page-context";
import type { SearchParams } from "@/lib/server/params";

export const metadata = { title: "People & Powers" };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  return <SectionOverview ctx={await requirePageContext()} section="people" searchParams={searchParams} />;
}
