#!/usr/bin/env node
/** Deletes the local demo state file; it is reseeded from fixtures on next request. */
import { rmSync } from "node:fs";
import path from "node:path";
const file = path.resolve(process.env.TIDE_DEMO_STATE_FILE || path.join(process.cwd(), ".tide-demo", "state.json"));
rmSync(file, { force: true });
console.log(`Removed ${file}. Demo data will be reseeded from fixtures on the next request.`);
