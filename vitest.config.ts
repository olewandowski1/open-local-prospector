import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Some suites migrate real SQLite files and copy artifacts, which the Windows CI runner has twice taken longer than vitest's five second default to finish.
    testTimeout: 20_000,
  },
})
