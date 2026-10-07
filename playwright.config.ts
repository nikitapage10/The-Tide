import { defineConfig, devices } from "@playwright/test";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * E2E runs against a production build in explicit local demo mode with a
 * throwaway state file. Build first: `npm run build`.
 * Set PW_CHROMIUM_PATH to use a preinstalled Chromium instead of `npx playwright install`.
 */
const stateFile = path.join(process.cwd(), ".tide-demo", "e2e-state.json");
rmSync(stateFile, { force: true });
const PORT = Number(process.env.E2E_PORT ?? 3210);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/setup`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      TIDE_DATA_MODE: "demo",
      TIDE_ALLOW_DEMO_IN_PRODUCTION_BUILD: "true",
      TIDE_DEMO_STATE_FILE: stateFile,
    },
  },
});
