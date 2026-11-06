import { randomUUID } from "node:crypto";
import { requireGmPageContext } from "@/lib/server/page-context";
import { PageHeader } from "@/components/shell/PageHeader";
import { DraftEditor } from "@/components/codex/DraftEditor";
export const metadata = { title: "New working draft" };
export default async function NewDraftPage() {
  await requireGmPageContext();
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/workshop/drafts", label: "Working drafts" }]}
        title="A new thread"
        description="Work out the idea here before deciding what belongs in shared canon."
      />
      <DraftEditor
        versionId={null}
        record={{
          id: randomUUID(),
          type: "entity",
          kind: "concept",
          title: "",
          body: "",
          summary: "",
          tags: ["working draft", "post-Tide"],
          era: "today",
          visibility: "gm_only",
          canonStatus: "unverified",
          demo: false,
        }}
      />
    </>
  );
}
