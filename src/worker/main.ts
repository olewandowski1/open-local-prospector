import { Console, Effect, Layer, Option } from "effect"

import {
  makeBraveSearchSource,
  makeDiscoveryTaskExecutor,
  makeSqliteDiscoveryRepository,
} from "@/features/business-discovery"
import {
  makeIdentityTaskExecutor,
  makeSqliteIdentityRepository,
} from "@/features/business-identity"
import { loadLocalApplicationConfig, migrateLocalDatabase } from "@/features/local-application"
import { loadWorkerConfiguration, runWorker } from "@/features/run-execution/application/worker"
import { sqliteRunTaskRepositoryLive } from "@/features/run-execution/infrastructure/sqlite-run-task-repository"
import { stageExecutorLive } from "@/features/run-execution/infrastructure/stage-executor-live"
import { resolveRuntimeExecutable } from "@/features/runtime-settings"
import {
  makeAssessmentTaskExecutor,
  makeCodexAssessmentRuntime,
  makeSqliteAssessmentRepository,
} from "@/features/website-assessment"
import {
  makeInspectionTaskExecutor,
  makePlaywrightWebsiteInspector,
  makeSqliteInspectionRepository,
} from "@/features/website-inspection"

const localConfig = loadLocalApplicationConfig()
const braveSearch = makeBraveSearchSource(process.env.BRAVE_SEARCH_API_KEY)
const executeDiscovery = makeDiscoveryTaskExecutor(
  braveSearch,
  makeSqliteDiscoveryRepository(localConfig.databasePath),
)
const executeIdentity = makeIdentityTaskExecutor(
  braveSearch,
  makeSqliteIdentityRepository(localConfig.databasePath),
)
const executeInspection = makeInspectionTaskExecutor(
  makePlaywrightWebsiteInspector(),
  makeSqliteInspectionRepository(localConfig.databasePath),
  localConfig.artifactsPath,
)

const program = Effect.gen(function* () {
  const worker = loadWorkerConfiguration()
  yield* Effect.try(() => migrateLocalDatabase(localConfig.databasePath))
  const codexExecutable = yield* resolveRuntimeExecutable("codex")
  const assessmentRuntimes = Option.isSome(codexExecutable)
    ? { codex: makeCodexAssessmentRuntime(codexExecutable.value) }
    : {}
  const executeAssessment = makeAssessmentTaskExecutor(
    makeSqliteAssessmentRepository(localConfig.databasePath),
    assessmentRuntimes,
  )
  yield* Console.log(
    `Worker ready with concurrency ${worker.concurrency}; SQLite: ${localConfig.databasePath}`,
  )
  if (!process.argv.includes("--check")) {
    yield* runWorker(`worker-${process.pid}-${crypto.randomUUID()}`, worker).pipe(
      Effect.provide(
        Layer.merge(
          sqliteRunTaskRepositoryLive(localConfig.databasePath),
          stageExecutorLive(
            executeDiscovery,
            executeIdentity,
            executeInspection,
            executeAssessment,
          ),
        ),
      ),
    )
  }
})

await Effect.runPromise(program)
