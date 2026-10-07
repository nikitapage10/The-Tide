"use client";
import { useState } from "react";
import { normalizeForSearch } from "@/lib/domain/normalize";

export interface LinkOption {
  id: string;
  title: string;
  group: string;
  demo: boolean;
}

/** Accessible multi-select of stable record IDs (checkbox list with a filter). */
export function LinkPicker({ id, legend, options, value, onChange }: { id: string; legend: string; options: LinkOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const nq = normalizeForSearch(q);
  const shown = options.filter((o) => !nq || normalizeForSearch(o.title).includes(nq) || value.includes(o.id));
  const groups = [...new Set(shown.map((o) => o.group))];
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <label htmlFor={`${id}-filter`} className="sr-only">
        Filter {legend}
      </label>
      <input id={`${id}-filter`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="mb-2 w-full rounded-md border border-border-strong bg-bg px-3 py-1.5" />
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g}>
            <p className="eyebrow mb-1">{g}</p>
            {shown
              .filter((o) => o.group === g)
              .map((o) => (
                <label key={o.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <input
                    type="checkbox"
                    checked={value.includes(o.id)}
                    onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((v) => v !== o.id))}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {o.title}
                  {o.demo ? <span className="text-xs text-demo">(demo)</span> : null}
                </label>
              ))}
          </div>
        ))}
        {!shown.length ? <p className="text-sm text-faint">No matches.</p> : null}
      </div>
      <p className="mt-1 text-xs text-faint" aria-live="polite">
        {value.length} linked
      </p>
    </fieldset>
  );
}
