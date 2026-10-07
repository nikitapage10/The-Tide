import { EntryPage } from "@/components/records/EntityPages";
import { requirePageContext } from "@/lib/server/page-context";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EntryPage ctx={await requirePageContext()} section="world" id={(await params).id} />;
}
