/**
 * A sigil from the art sheets: a thin luminous line mark on transparency.
 * Decorative by default (its meaning is always written beside it).
 */
import Image from "next/image";

export function ArtSigil({ src, size = 32, alt = "", className = "" }: { src: string; size?: number; alt?: string; className?: string }) {
  return <Image src={src} alt={alt} width={size} height={size} aria-hidden={alt ? undefined : true} className={`art-sigil inline-block shrink-0 ${className}`} />;
}
