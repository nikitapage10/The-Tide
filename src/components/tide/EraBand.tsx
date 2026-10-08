/**
 * The long history in one strip: before the Undertow, the Undertow, the Age
 * of the Veil, the Era of Verdancy, the Tide, today. Widths are rough
 * proportions, not a scale (the documents give only approximate spans).
 */
import type { Era } from "@/lib/contract/schema";

export const ERA_INFO: { era: Era; label: string; span: string; weight: number }[] = [
  { era: "before_undertow", label: "The Shoreborn", span: "until ~2102 B.U.", weight: 1.2 },
  { era: "undertow", label: "The Undertow", span: "~9 months", weight: 0.35 },
  { era: "veil", label: "The Age of the Veil", span: "~700 years", weight: 1.6 },
  { era: "verdancy", label: "The Era of Verdancy", span: "~3,200 years", weight: 3.2 },
  { era: "tide", label: "The Tide", span: "still unfolding", weight: 0.9 },
  { era: "today", label: "Today", span: "", weight: 0.45 },
];

export function eraLabel(era: Era | null | undefined): string | null {
  return ERA_INFO.find((e) => e.era === era)?.label ?? null;
}

export function EraBand({ current, compact = false, className = "" }: { current?: Era | null; compact?: boolean; className?: string }) {
  return (
    <ol className={`era-band flex w-full ${className}`} aria-label="Eras">
      {ERA_INFO.map((e) => {
        const on = e.era === current;
        return (
          <li key={e.era} className="era-cell min-w-0" style={{ flexGrow: e.weight, flexBasis: 0 }} data-on={on ? "" : undefined} aria-current={on ? "true" : undefined}>
            <span aria-hidden="true" className="era-rule" />
            {compact && !on ? <span className="sr-only">{e.label}</span> : (
              <span className="block truncate pt-2">
                <span className={`tracked block truncate text-[0.6rem] ${on ? "text-white" : "text-faint"}`}>{e.label}</span>
                {!compact && e.span ? <span className="block truncate font-[family-name:var(--font-mono)] text-[0.58rem] text-faint">{e.span}</span> : null}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
