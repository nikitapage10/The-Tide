/**
 * The opening of a sub-page: a huge, faint index numeral behind, the path,
 * the title decoding from the script, what the room holds, and a way to see
 * the same entries as a plain filterable list.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Decode } from "@/components/glyphs/Decode";

export function GroupHero({
  section,
  sectionHref,
  index,
  title,
  description,
  count,
  noun,
  listHref,
  children,
}: {
  section: string;
  sectionHref: string;
  index: string;
  title: string;
  description: string;
  count: number;
  noun: [string, string];
  listHref?: string;
  children?: ReactNode;
}) {
  return (
    <header className="group-hero relative mb-14 pt-4">
      <span aria-hidden="true" className="group-hero-numeral">
        {index}
      </span>
      <nav aria-label="Breadcrumb" className="tracked relative mb-6 flex items-center gap-3 text-[0.62rem] text-faint">
        <Link href={sectionHref} className="text-faint no-underline hover:text-white">
          {section}
        </Link>
        <span aria-hidden="true" className="tint-rule h-px w-10" />
        <span className="tint-text">{index}</span>
      </nav>
      <h1 className="t-display-xl relative">
        <Decode text={title} active delay={100} />
      </h1>
      <div className="relative mt-6 flex flex-wrap items-end justify-between gap-6">
        <p className="t-lede max-w-2xl">{description}</p>
        <p className="tracked flex items-center gap-4 text-[0.62rem] text-faint">
          <span>
            {count} {count === 1 ? noun[0] : noun[1]}
          </span>
          {listHref ? (
            <Link href={listHref} className="text-faint no-underline hover:text-white">
              As a list →
            </Link>
          ) : null}
        </p>
      </div>
      {children}
    </header>
  );
}

/** When a room is empty, it still looks like the room. */
export function EmptyRoom({ children }: { children: ReactNode }) {
  return (
    <div className="empty-room relative grid min-h-[16rem] place-items-center overflow-hidden border border-dashed border-white/10 p-10 text-center">
      <p className="t-lede relative max-w-md">{children}</p>
    </div>
  );
}
