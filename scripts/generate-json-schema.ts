/** Writes contract/tide.publication.v1.schema.json from the Zod contract (single source of truth). */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zBundle } from "../src/lib/contract/schema";

const schema = z.toJSONSchema(zBundle, { target: "draft-2020-12", io: "input" });
const out = {
  $id: "https://the-tide.invalid/contract/tide.publication.v1.schema.json",
  title: "The Tide publication bundle (tide.publication.v1)",
  description:
    "Generated from src/lib/contract/schema.ts. Structural rules only; semantic rules (references, URL safety, duplicates, base release) are enforced by the publication service and documented in docs/PUBLICATION_CONTRACT.md.",
  ...schema,
};
// Also served from the site (the publisher's OpenAPI document links to it).
for (const dir of ["contract", path.join("public", "contract")]) {
  mkdirSync(path.join(process.cwd(), dir), { recursive: true });
  const file = path.join(process.cwd(), dir, "tide.publication.v1.schema.json");
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
