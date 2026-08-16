import { resolve } from "node:path"

export type LocalApplicationConfig = Readonly<{
  databasePath: string
  artifactsPath: string
  environmentPath: string
  environmentTemplatePath: string
}>

type LocalEnvironment = Readonly<Record<string, string | undefined>>

export function loadLocalApplicationConfig(
  environment: LocalEnvironment = process.env,
  workingDirectory = process.cwd(),
): LocalApplicationConfig {
  return {
    databasePath: resolve(
      workingDirectory,
      environment.PROSPECTOR_DATABASE_PATH ?? ".local/open-local-prospector.sqlite",
    ),
    artifactsPath: resolve(
      workingDirectory,
      environment.PROSPECTOR_ARTIFACTS_PATH ?? ".local/artifacts",
    ),
    environmentPath: resolve(workingDirectory, ".env.local"),
    environmentTemplatePath: resolve(workingDirectory, ".env.local.example"),
  }
}

export function hasBraveSearchConfiguration(environment: LocalEnvironment = process.env): boolean {
  return Boolean(environment.BRAVE_SEARCH_API_KEY?.trim())
}
