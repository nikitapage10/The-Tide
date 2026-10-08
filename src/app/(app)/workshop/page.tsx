import { SectionIntro } from "@/components/tide/SectionIntro";
import { Notice } from "@/components/ui/States";
import { Bench } from "@/components/workshop/Bench";
import { publicScope } from "@/lib/domain/audience";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata = { title: "The Workshop" };

export default async function WorkshopPage() {
  const ctx = await requirePageContext();
  // The bench is the GM's (visitors see it only in the open preview).
  const closed = ctx.audience !== "gm" && publicScope() === "tiered";
  return (
    <div data-section="workshop">
      <SectionIntro index="05" eyebrow="Workshop" title="The Workshop" lede="The bench: sessions and prep, the print queue and builds, the press that publishes the lore, and the labs." />
      {closed ? (
        <Notice title="The GM's workshop">Sign in as the GM to use the workshop.</Notice>
      ) : (
        <Bench ctx={ctx} />
      )}
    </div>
  );
}
