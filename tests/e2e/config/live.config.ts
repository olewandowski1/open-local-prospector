import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const workspace = resolve(".scratch/live-e2e")
const port = 4313

export default defineConfig({
  testDir: resolve("tests/e2e/live"),
  outputDir: resolve(".scratch/live-results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: resolve("."),
    command: `node --import tsx tests/e2e/live/prepare-live-workspace.ts && pnpm exec next build && pnpm exec concurrently --kill-others --names web,worker "pnpm exec next start --hostname 127.0.0.1 --port ${port}" "node --import tsx src/worker/main.ts"`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      PROSPECTOR_DATABASE_PATH: resolve(workspace, "workspace.sqlite"),
      PROSPECTOR_ARTIFACTS_PATH: resolve(workspace, "artifacts"),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
