/**
 * The opening of a section or an entry: a numbered eyebrow, a large title that
 * decodes from the Tide's script, and a lede in the display face. Children
 * sit beneath (an era band, a rule, actions).
 */
import type { ReactNode } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { renameWorld } from "@/lib/domain/world-name";

export function SectionIntro({ index, eyebrow, title, lede, size = "l", children, id }: { index?: string; eyebrow: string; title: string; lede?: ReactNode; size?: "xl" | "l" | "m"; children?: ReactNode; id?: string }) {
  return (
    <header className="mb-12 max-w-5xl space-y-5 pt-4">
      <p className="tracked flex items-center gap-3 text-[0.65rem] text-faint">
        {index ? <span className="tint-text">{index}</span> : null}
        {index ? <span aria-hidden="true">/</span> : null}
        <span>{eyebrow}</span>
        <span aria-hidden="true" className="tint-rule h-px w-14" />
      </p>
      <h1 id={id} className={size === "xl" ? "t-display-xl" : size === "m" ? "t-display-m" : "t-display-l"}>
        <Decode text={renameWorld(title)} active delay={120} />
      </h1>
      {lede ? <div className="t-lede max-w-3xl">{lede}</div> : null}
      {children}
    </header>
  );
}
