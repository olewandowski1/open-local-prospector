import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  // One dev server serves every worker, and several pages spawn provider CLIs to probe readiness.
  // Above this, workers starve each other and assertions time out on a healthy application.
  workers: 3,
  use: {
    baseURL: "http://127.0.0.1:4310",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:4310",
    // The developer keeps their own server on this port; tests attach to it rather than fighting it
    // for the binding, which would fail their run with EADDRINUSE.
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 12"] } },
  ],
})
