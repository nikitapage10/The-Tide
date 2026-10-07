#!/usr/bin/env node
/**
 * Scans the built browser assets (.next/static) for server-only secrets.
 * Build first with sentinel values, e.g.:
 *   SUPABASE_SECRET_KEY=tide-sentinel-secret-key SUPABASE_SERVICE_ROLE_KEY=tide-sentinel-service-role \
 *   TIDE_PUBLISHER_TOKEN_SHA256=<64 hex chars of 'e'> npm run build && npm run check:bundle-secrets
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), ".next", "static");
const needles = [
  "tide-sentinel-secret-key",
  "tide-sentinel-service-role",
  "e".repeat(64),
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TIDE_PUBLISHER_TOKEN_SHA256",
  // Fixture-only private text: proves server data/fixtures are not bundled client-side.
  "Demo GM note: private working notes",
  "tide_commit_release",
];
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html|json|map|txt)$/.test(f)) files.push(p);
  }
})(root);
let failures = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const n of needles) {
    if (text.includes(n)) {
      console.error(`LEAK: "${n}" found in ${path.relative(process.cwd(), file)}`);
      failures++;
    }
  }
}
console.log(`Scanned ${files.length} client asset files for ${needles.length} markers: ${failures ? `${failures} leak(s)` : "no leaks"}.`);
process.exit(failures ? 1 : 0);
