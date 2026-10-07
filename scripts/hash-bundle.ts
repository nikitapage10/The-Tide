/**
 * Validates a bundle structurally and prints its canonical bundle hash.
 * Usage: npm run contract:hash -- path/to/bundle.json
 */
import { readFileSync } from "node:fs";
import { parseBundleText } from "../src/lib/domain/publication";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run contract:hash -- <bundle.json>");
  process.exit(2);
}
const result = parseBundleText(readFileSync(file, "utf8"));
if (!result.ok) {
  console.error(`invalid (${result.code}):`);
  for (const i of result.issues) console.error(`  ${i.code} ${i.path ?? ""} ${i.message}`);
  process.exit(1);
}
console.log(result.hash);
