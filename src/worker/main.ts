import { Console, Effect, Layer } from "effect"

import { loadLocalApplicationConfig, migrateLocalDatabase } from "@/features/local-application"
import { loadWorkerConfiguration, runWorker } from "@/features/run-execution/application/worker"
import { sqliteRunTaskRepositoryLive } from "@/features/run-execution/infrastructure/sqlite-run-task-repository"
import { StageExecutorLive } from "@/features/run-execution/infrastructure/stage-executor-live"

const program = Effect.gen(function* () {
  const config = loadLocalApplicationConfig()
  const worker = loadWorkerConfiguration()
  yield* Effect.try(() => migrateLocalDatabase(config.databasePath))
  yield* Console.log(
    `Worker ready with concurrency ${worker.concurrency}; SQLite: ${config.databasePath}`,
  )
  if (!process.argv.includes("--check")) {
    yield* runWorker(`worker-${process.pid}-${crypto.randomUUID()}`, worker)
  }
}).pipe(
  Effect.provide(
    Layer.merge(
      sqliteRunTaskRepositoryLive(loadLocalApplicationConfig().databasePath),
      StageExecutorLive,
    ),
  ),
)

await Effect.runPromise(program)
