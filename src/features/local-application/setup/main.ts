import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { prepareLocalApplication } from "@/features/local-application/setup/prepare-local-application"

try {
  const result = prepareLocalApplication(loadLocalApplicationConfig())
  process.stdout.write(
    `${[
      "Local application is ready.",
      `SQLite: ${result.databasePath}`,
      `Artifacts: ${result.artifactsPath}`,
      `Playwright Chromium: ${result.chromium}`,
      "Discovery uses the selected provider subscription runtime; no search API key is needed.",
      "Provider subscription credentials are not requested or stored by setup.",
    ].join("\n")}\n`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
