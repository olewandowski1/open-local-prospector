import { Console, Effect, Layer } from "effect"

import {
  makeBraveSearchSource,
  makeDiscoveryTaskExecutor,
  makeSqliteDiscoveryRepository,
} from "@/features/business-discovery"
import { loadLocalApplicationConfig, migrateLocalDatabase } from "@/features/local-application"
import { loadWorkerConfiguration, runWorker } from "@/features/run-execution/application/worker"
import { sqliteRunTaskRepositoryLive } from "@/features/run-execution/infrastructure/sqlite-run-task-repository"
import { stageExecutorLive } from "@/features/run-execution/infrastructure/stage-executor-live"

const localConfig = loadLocalApplicationConfig()
const executeDiscovery = makeDiscoveryTaskExecutor(
  makeBraveSearchSource(process.env.BRAVE_SEARCH_API_KEY),
  makeSqliteDiscoveryRepository(localConfig.databasePath),
)

const program = Effect.gen(function* () {
  const worker = loadWorkerConfiguration()
  yield* Effect.try(() => migrateLocalDatabase(localConfig.databasePath))
  yield* Console.log(
    `Worker ready with concurrency ${worker.concurrency}; SQLite: ${localConfig.databasePath}`,
  )
  if (!process.argv.includes("--check")) {
    yield* runWorker(`worker-${process.pid}-${crypto.randomUUID()}`, worker)
  }
}).pipe(
  Effect.provide(
    Layer.merge(
      sqliteRunTaskRepositoryLive(loadLocalApplicationConfig().databasePath),
      stageExecutorLive(executeDiscovery),
    ),
  ),
)

await Effect.runPromise(program)
