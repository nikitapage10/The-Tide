/**
 * A plate, as in a museum catalogue or a specimen book: an image held in the
 * dark, lit faintly by its subject's own colour, with a quiet caption. Without
 * an image it shows one of the Unknowns (art sheet 28: a shrouded figure, a
 * creature in fog, a fog-bound land), dimmed (never an empty box).
 */
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { unknown } from "@/lib/art";

export function Plate({
  src,
  alt,
  palette,
  ratio = "3 / 4",
  unknownAs,
  href,
  caption,
  sizes = "(min-width: 1024px) 25vw, 60vw",
  priority = false,
  className = "",
}: {
  src?: string | null;
  alt: string;
  /** Kept for callers: identifies the subject (no longer drawn). */
  seed: string;
  palette?: string | null;
  ratio?: string;
  /** Which stand-in to show without an image (by default: a figure when tall, a land when wide). */
  unknownAs?: "figure" | "creature" | "landscape";
  href?: string;
  caption?: ReactNode;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const style = { aspectRatio: ratio, ...(palette ? { "--plate-glow": palette } : {}) } as CSSProperties;
  const figure = (
    <figure className={`plate group ${className}`}>
      <div className="plate-frame relative w-full overflow-hidden" style={style}>
        {src ? (
          <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="plate-img object-cover" />
        ) : (
          <div className="plate-unknown absolute inset-0 grid place-items-center">
            <Image src={unknown(unknownAs ?? (tall(ratio) ? "figure" : "landscape"))} alt="" fill sizes={sizes} className="object-cover" />
          </div>
        )}
        <span aria-hidden="true" className="plate-glow" />
      </div>
      {caption ? <figcaption className="pt-3">{caption}</figcaption> : null}
    </figure>
  );
  return href ? (
    <Link href={href} className="block no-underline">
      {figure}
    </Link>
  ) : (
    figure
  );
}

/** Is a ratio like "3 / 4" taller than wide? */
function tall(ratio: string) {
  const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
  return !!w && !!h && h > w;
}
