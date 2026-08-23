import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const workspace = resolve(".scratch/docs-e2e")
const port = 4314

export default defineConfig({
  testDir: resolve("tests/e2e/docs"),
  outputDir: resolve(".scratch/docs-results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    colorScheme: "light",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    cwd: resolve("."),
    command: `node --import tsx tests/e2e/support/seed-workspace.ts && pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      PROSPECTOR_E2E_WORKSPACE: workspace,
      PROSPECTOR_DATABASE_PATH: resolve(workspace, "workspace.sqlite"),
      PROSPECTOR_ARTIFACTS_PATH: resolve(workspace, "artifacts"),
    },
  },
})
