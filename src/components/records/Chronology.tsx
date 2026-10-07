import type { Chronology as C } from "@/lib/contract/schema";

export function Chronology({ chronology }: { chronology: C | null | undefined }) {
  if (!chronology) return null;
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p className="eyebrow mb-1">Chronology</p>
      <p>
        {chronology.label ?? <span className="text-muted">Placement not supplied</span>}{" "}
        <span className="text-faint">· certainty: {chronology.certainty}</span>
      </p>
      {chronology.notes ? <p className="text-muted">{chronology.notes}</p> : null}
    </div>
  );
}
