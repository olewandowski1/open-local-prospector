import { Console, Effect, Layer, Option } from "effect"

import {
  makeDiscoveryTaskExecutor,
  makeSqliteDiscoveryRepository,
  makeSubscriptionDiscoveryRuntime,
} from "@/features/business-discovery"
import {
  makeIdentityTaskExecutor,
  makeSqliteIdentityRepository,
} from "@/features/business-identity"
import {
  closeSharedDatabases,
  loadLocalApplicationConfig,
  migrateLocalDatabase,
} from "@/features/local-application"
import { makeScoreCandidateTaskExecutor } from "@/features/review-queue"
import { loadWorkerConfiguration, runWorker } from "@/features/run-execution/application/worker"
import { sqliteRunTaskRepositoryLive } from "@/features/run-execution/infrastructure/sqlite-run-task-repository"
import { stageExecutorLive } from "@/features/run-execution/infrastructure/stage-executor-live"
import { executeRuntimeCommand, resolveRuntimeExecutable } from "@/features/runtime-settings"
import {
  makeAssessmentTaskExecutor,
  makeClaudeAssessmentRuntime,
  makeCodexAssessmentRuntime,
  makeSqliteAssessmentRepository,
} from "@/features/website-assessment"
import {
  makeInspectionTaskExecutor,
  makePlaywrightWebsiteInspector,
  makeSqliteInspectionRepository,
} from "@/features/website-inspection"
import { tryAcquireWorkspaceOperationLease } from "@/features/workspace-administration"

const localConfig = loadLocalApplicationConfig()
const executeInspection = makeInspectionTaskExecutor(
  makePlaywrightWebsiteInspector(),
  makeSqliteInspectionRepository(localConfig.databasePath),
  localConfig.artifactsPath,
)
const executeScoring = makeScoreCandidateTaskExecutor(localConfig.databasePath)

const program = Effect.gen(function* () {
  const worker = loadWorkerConfiguration()
  yield* Effect.try(() => migrateLocalDatabase(localConfig.databasePath))
  const codexExecutable = yield* resolveRuntimeExecutable("codex")
  const claudeExecutable = yield* resolveRuntimeExecutable("claude")
  const runtimeExecutables = {
    ...(Option.isSome(codexExecutable) ? { codex: codexExecutable.value } : {}),
    ...(Option.isSome(claudeExecutable) ? { claude: claudeExecutable.value } : {}),
  }
  const discoveryRuntime = makeSubscriptionDiscoveryRuntime(runtimeExecutables)
  const executeDiscovery = makeDiscoveryTaskExecutor(
    discoveryRuntime,
    makeSqliteDiscoveryRepository(localConfig.databasePath),
  )
  const executeIdentity = makeIdentityTaskExecutor(
    makeSqliteIdentityRepository(localConfig.databasePath),
  )
  const assessmentRuntimes = {
    ...(Option.isSome(codexExecutable)
      ? {
          codex: makeCodexAssessmentRuntime(
            codexExecutable.value,
            undefined,
            yield* runtimeVersion(codexExecutable.value),
          ),
        }
      : {}),
    ...(Option.isSome(claudeExecutable)
      ? {
          claude: makeClaudeAssessmentRuntime(
            claudeExecutable.value,
            undefined,
            yield* runtimeVersion(claudeExecutable.value),
          ),
        }
      : {}),
  }
  const executeAssessment = makeAssessmentTaskExecutor(
    makeSqliteAssessmentRepository(localConfig.databasePath),
    assessmentRuntimes,
  )
  yield* Console.log(
    `Worker ready with concurrency ${worker.concurrency}; SQLite: ${localConfig.databasePath}`,
  )
  if (!process.argv.includes("--check")) {
    yield* runWorker(
      `worker-${process.pid}-${crypto.randomUUID()}`,
      worker,
      () => tryAcquireWorkspaceOperationLease(localConfig.databasePath),
      closeSharedDatabases,
    ).pipe(
      Effect.provide(
        Layer.merge(
          sqliteRunTaskRepositoryLive(localConfig.databasePath),
          stageExecutorLive({
            DiscoverBusinesses: executeDiscovery,
            CorroborateBusiness: executeIdentity,
            InspectWebsite: executeInspection,
            AssessWebsiteOpportunity: executeAssessment,
            ScoreCandidate: executeScoring,
          }),
        ),
      ),
    )
  }
})

await Effect.runPromise(program)

function runtimeVersion(executable: string) {
  return executeRuntimeCommand(executable, ["--version"]).pipe(
    Effect.map((result) => result.stdout.trim().slice(0, 200) || "unknown"),
    Effect.catchAll(() => Effect.succeed("unknown")),
  )
}
