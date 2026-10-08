import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata = { title: "Alphabet lab" };

const STYLES = ["Slot reels", "Typewriter", "Cascade", "Scramble", "Fade through", "Card flip", "Centre out", "Random order", "Scan wipe", "Ink bleed", "Interlinear", "Morph"];

/** The Workshop's entry to the alphabet lab (which runs on its own page). */
export default function AlphabetLabEntry() {
  return (
    <>
      <PageHeader eyebrow="The Workshop" title="Alphabet lab" description="The Tide's script translating into English, twelve different ways, side by side; with the full alphabet." />
      <div className="space-y-6">
        <Link href="/lab/alphabet" className="tracked inline-block border border-white/30 px-4 py-3 text-[0.7rem] text-white no-underline hover:border-white">
          Open the alphabet lab
        </Link>
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          {STYLES.map((m, i) => (
            <li key={m} className="border-l border-white/10 pl-3">
              <span className="tracked mr-2 text-[0.62rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
              {m}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
