import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const workspace = resolve(".scratch/e2e")
const port = 4312

export default defineConfig({
  testDir: "./tests/e2e/app",
  outputDir: resolve(".scratch/e2e-results"),
  fullyParallel: true,
  retries: 0,
  // Limit contention because one server serves all workers and probes provider CLIs.
  workers: 3,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    // Seed before boot and serve a production build to avoid first-request compilation races.
    command: `node --import tsx tests/e2e/support/seed-workspace.ts && pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    // Never attach tests to the developer's server or workspace.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      PROSPECTOR_DATABASE_PATH: resolve(workspace, "workspace.sqlite"),
      PROSPECTOR_ARTIFACTS_PATH: resolve(workspace, "artifacts"),
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      // Test the phone viewport in the Chromium browser installed by setup.
      use: { ...devices["iPhone 12"], browserName: "chromium" },
    },
  ],
})
