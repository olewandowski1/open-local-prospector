import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const workspaceRoot = resolve(".scratch/workspace-e2e")
process.env.PROSPECTOR_ISOLATED_WORKSPACE_TEST = "1"

export default defineConfig({
  testDir: resolve("tests/e2e/workspace"),
  outputDir: resolve(".scratch/workspace-results"),
  workers: 1,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4311",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: resolve("."),
    command: "pnpm exec next start --hostname 127.0.0.1 --port 4311",
    url: "http://127.0.0.1:4311/settings/appearance",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PROSPECTOR_DATABASE_PATH: resolve(workspaceRoot, "workspace.sqlite"),
      PROSPECTOR_ARTIFACTS_PATH: resolve(workspaceRoot, "artifacts"),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
