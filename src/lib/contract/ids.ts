/**
 * Deterministic record IDs: a UUID (version 5, RFC 9562) from the project ID
 * and a stable name such as "people/teruanga". The publisher and our tools
 * derive the same ID for the same thing, so updates never create duplicates.
 *
 * Names are lowercase "<area>/<slug>" (letters, digits, hyphens; one slash).
 * Renaming a record's title never changes its name or ID.
 */
import { createHash } from "node:crypto";

export const STABLE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function bytesOf(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

export function uuidV5(namespace: string, name: string): string {
  const hash = createHash("sha1").update(bytesOf(namespace)).update(name, "utf8").digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The ID for a stable name within a project. */
export function recordId(projectId: string, name: string): string {
  if (!STABLE_NAME.test(name)) throw new Error(`Stable names look like "people/teruanga" (got "${name}")`);
  return uuidV5(projectId, name);
}

/** A slug from a title: ASCII letters and digits, hyphenated ("Teruānga" → "teruanga"). */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
