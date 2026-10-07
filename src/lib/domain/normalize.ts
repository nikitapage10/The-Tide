/** Accent-, case- and apostrophe-insensitive normalization. Safe for client and server. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’'‘`ʼ´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
