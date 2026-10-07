/**
 * The Tide's script: each letter or digit is written as a pair of glyphs read
 * together: the geometric meridian glyph followed by the flowing crescent
 * glyph (a real cipher, so the same letter always reads the same). Traced from
 * art/alphabet.png by scripts/build-glyphs.py; drawn as masks so they take the
 * text colour.
 */
import { GLYPH_ASPECT } from "./alphabet";

/** Characters the script has glyphs for; anything else is shown as itself. */
export function hasGlyph(ch: string) {
  return /^[A-Za-z0-9]$/.test(ch);
}

const GAP = 0.08; // between the pair, as a fraction of the glyph height

function Mask({ name, aspect }: { name: string; aspect: number }) {
  const url = `url(/brand/glyphs/${name}.webp)`;
  return (
    <span
      style={{
        display: "block",
        height: "100%",
        aspectRatio: String(aspect),
        backgroundColor: "currentColor",
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}

/**
 * One character in the script (its two glyphs). It fits within `--glyph-w`
 * (default about a letter's width) and is at most `--glyph-h` tall.
 */
export function TideGlyph({ ch, className }: { ch: string; className?: string }) {
  const k = ch.toLowerCase();
  const a = GLYPH_ASPECT[`${k}-a`] ?? 0.5;
  const b = GLYPH_ASPECT[`${k}-b`] ?? 0.5;
  const pair = a + b + GAP;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "flex",
        gap: `calc(var(--glyph-h, 1.3em) * ${GAP})`,
        height: `min(var(--glyph-h, 1.3em), calc(var(--glyph-w, 1.25em) / ${pair.toFixed(3)}))`,
      }}
    >
      <Mask name={`${k}-a`} aspect={a} />
      <Mask name={`${k}-b`} aspect={b} />
    </span>
  );
}
