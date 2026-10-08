import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata = { title: "Orbit sketch" };

/** The Workshop's entry to the orbit sketch (which runs full screen on its own page). */
export default function OrbitLabEntry() {
  return (
    <>
      <PageHeader
        eyebrow="The Workshop"
        title="Orbit sketch"
        description="Draw how things should move around the planet, compare with the current paths, and copy the drawing so it can be reproduced exactly."
      />
      <div className="space-y-6">
        <Link href="/lab/orbit" className="tracked inline-block border border-white/30 px-4 py-3 text-[0.7rem] text-white no-underline hover:border-white">
          Open the orbit sketch
        </Link>
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          {["Draw a path: start where it appears, end where it disappears", "Draw several for different kinds of pass", "Show the current paths (dashed) to compare", "Copy the drawing as points relative to the planet"].map((m, i) => (
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
