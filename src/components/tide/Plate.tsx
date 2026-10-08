/**
 * A plate, as in a museum catalogue or a specimen book: an image held in the
 * dark, lit faintly by its subject's own colour, with a quiet caption. Without
 * an image it shows the procedural mark instead (never an empty box).
 */
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ProceduralMark } from "@/components/ui/ProceduralMark";

export function Plate({
  src,
  alt,
  seed,
  palette,
  ratio = "3 / 4",
  href,
  caption,
  sizes = "(min-width: 1024px) 25vw, 60vw",
  priority = false,
  className = "",
}: {
  src?: string | null;
  alt: string;
  seed: string;
  palette?: string | null;
  ratio?: string;
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
          <div className="absolute inset-0 grid place-items-center">
            <ProceduralMark seed={seed} size={96} />
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
