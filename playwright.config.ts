import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

const workspace = resolve(".scratch/e2e")
const port = 4312

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  // One server serves every worker, and several pages spawn provider CLIs to probe readiness.
  // Above this, workers starve each other and assertions time out on a healthy application.
  workers: 3,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    // The seed runs here, not in `globalSetup`, because Playwright starts the server first and
    // the server opens the database as soon as it boots. A production build, not `next dev`:
    // Turbopack compiles a route on its first request, and a click landing during that compile is
    // a genuine no-op, so parallel workers raced hydration and failed on a healthy application.
    command: `node --import tsx tests/e2e/seed-workspace.ts && pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    // The suite owns this port and this workspace. It used to attach to the developer's server on
    // 4310, which meant the specs could only pass on a machine that already held the right runs,
    // and a destructive test would have reached real data.
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
      // `devices["iPhone 12"]` carries `defaultBrowserType: "webkit"`, so without this override the
      // project silently launched WebKit — which `pnpm run setup` does not install, so every mobile
      // test failed on a fresh machine asking for browsers. What is under test is the responsive
      // layout at a phone viewport, not Safari.
      use: { ...devices["iPhone 12"], browserName: "chromium" },
    },
  ],
})
