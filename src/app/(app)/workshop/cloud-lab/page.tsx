import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata = { title: "Cloud lab" };

const MODELS = [
  "Fluid",
  "Eddies",
  "Particles",
  "Dissipate",
  "Nebula",
  "Curl flow",
  "Wake",
  "Puffs + air",
  "Light",
  "Layered (the planet's clouds)",
];

/** The Workshop's entry to the cloud lab (which runs full screen on its own page). */
export default function CloudLabEntry() {
  return (
    <>
      <PageHeader eyebrow="The Workshop" title="Cloud lab" description="A playground for the planet's weather: move through a patch of cloud seen from orbit and compare different simulation models." />
      <div className="space-y-6">
        <Link href="/lab/clouds" className="tracked inline-block border border-white/30 px-4 py-3 text-[0.7rem] text-white no-underline hover:border-white">
          Open the cloud lab
        </Link>
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          {MODELS.map((m, i) => (
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
