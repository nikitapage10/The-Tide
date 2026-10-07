/**
 * Canonical JSON (a JCS-style subset of RFC 8785) used for deterministic hashes.
 *
 * Rules:
 *  - Object keys are sorted by UTF-16 code unit order (JavaScript's default sort).
 *  - Properties whose value is `undefined` are omitted; `null` is kept.
 *  - Arrays keep their order (order is meaningful for display, never for identity).
 *  - Strings are serialized with JSON.stringify (UTF-8 when hashed), no Unicode normalization.
 *  - Numbers must be finite and are serialized with JSON.stringify.
 *  - No insignificant whitespace.
 */
import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("canonicalJson: non-finite number");
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
    }
    default:
      throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
  }
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Hash of a normalized bundle, excluding its own optional `bundleHash` field. */
export function computeBundleHash(bundle: object): string {
  const { bundleHash: _ignored, ...rest } = bundle as Record<string, unknown>;
  void _ignored;
  return `sha256:${sha256Hex(canonicalJson(rest))}`;
}

/** Hash of one published record's content, used to detect changes between releases. */
export function computeRecordHash(record: object): string {
  return `sha256:${sha256Hex(canonicalJson(record))}`;
}
