/**
 * The opening of a section or an entry: a numbered eyebrow, a large title that
 * decodes from the Tide's script, and a lede in the display face. Children
 * sit beneath (an era band, a rule, actions).
 *
 * A section's opening can stand in its art: `backdrop` lays a full-bleed
 * image behind it (fading into the page), and `numerals` sets the section's
 * number beside the title in glass numerals cut from the planet, as in the
 * World index (art sheets 7, 17, 25, 29).
 */
import Image from "next/image";
import type { ReactNode } from "react";
import { Decode } from "@/components/glyphs/Decode";
import { numeral } from "@/lib/art";
import { renameWorld } from "@/lib/domain/world-name";

export function SectionIntro({
  index,
  eyebrow,
  title,
  lede,
  size = "l",
  children,
  id,
  backdrop,
  numerals = false,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  size?: "xl" | "l" | "m";
  children?: ReactNode;
  id?: string;
  backdrop?: string;
  numerals?: boolean;
}) {
  const heading = (
    <h1 id={id} className={size === "xl" ? "t-display-xl" : size === "m" ? "t-display-m" : "t-display-l"}>
      <Decode text={renameWorld(title)} active delay={120} />
    </h1>
  );
  return (
    <header className={`relative mb-12 max-w-5xl space-y-5 pt-4 ${backdrop ? "section-intro-art" : ""}`}>
      {backdrop ? (
        <div aria-hidden="true" className="section-backdrop">
          <Image src={backdrop} alt="" fill sizes="100vw" priority className="object-cover" />
        </div>
      ) : null}
      <p className="tracked relative flex items-center gap-3 text-[0.65rem] text-faint">
        {index ? <span className="tint-text">{index}</span> : null}
        {index ? <span aria-hidden="true">/</span> : null}
        <span>{eyebrow}</span>
        <span aria-hidden="true" className="tint-rule h-px w-14" />
      </p>
      {numerals && index ? (
        <div className="relative flex items-end gap-6">
          <span aria-hidden="true" className="section-numerals">
            {[...index.replace(/\D/g, "")].map((d, k) => (
              <Image key={k} src={numeral(d)} alt="" width={240} height={480} priority />
            ))}
          </span>
          <div className="min-w-0 pb-2">{heading}</div>
        </div>
      ) : (
        <div className="relative">{heading}</div>
      )}
      {lede ? <div className="t-lede relative max-w-3xl">{lede}</div> : null}
      {children ? <div className="relative">{children}</div> : null}
    </header>
  );
}
