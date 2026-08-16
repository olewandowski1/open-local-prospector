import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: [
    "./src/features/local-application/infrastructure/database/schema.ts",
    "./src/features/runtime-settings/infrastructure/schema.ts",
    "./src/features/prospecting-runs/infrastructure/schema.ts",
    "./src/features/run-execution/infrastructure/schema.ts",
    "./src/features/run-monitoring/infrastructure/schema.ts",
    "./src/features/business-discovery/infrastructure/schema.ts",
    "./src/features/business-identity/infrastructure/schema.ts",
    "./src/features/website-inspection/infrastructure/schema.ts",
    "./src/features/website-assessment/infrastructure/schema.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.PROSPECTOR_DATABASE_PATH ?? ".local/open-local-prospector.sqlite",
  },
})
