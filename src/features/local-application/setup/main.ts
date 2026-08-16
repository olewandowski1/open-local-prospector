import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import {
  LocalSetupError,
  prepareLocalApplication,
} from "@/features/local-application/setup/prepare-local-application"

try {
  const result = prepareLocalApplication(loadLocalApplicationConfig())
  process.stdout.write(
    `${[
      "Local application is ready.",
      `SQLite: ${result.databasePath}`,
      `Artifacts: ${result.artifactsPath}`,
      `Playwright Chromium: ${result.chromium}`,
      "Add a Brave Search API key to .env.local when discovery is implemented.",
      "Provider subscription credentials are not requested or stored by setup.",
    ].join("\n")}\n`,
  )
} catch (error) {
  const message =
    error instanceof LocalSetupError ? error.message : "Local setup failed unexpectedly."
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
