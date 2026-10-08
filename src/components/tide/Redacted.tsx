/**
 * Text with the world's name withheld: plain runs as they are, each withheld
 * term as the glyph cipher. Use for titles, summaries and labels.
 */
import { splitRedacted } from "@/lib/domain/redaction";
import { WorldName } from "./WorldName";

export function Redacted({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const pieces = splitRedacted(text);
  if (pieces.length === 1 && typeof pieces[0] === "string") return <>{text}</>;
  return (
    <>
      {pieces.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <WorldName key={i} />))}
    </>
  );
}
