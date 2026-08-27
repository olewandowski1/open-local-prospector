import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Effect } from "effect"
import { executeRuntimeProcess, type RuntimeProcess } from "@/features/runtime-settings"

import {
  type AssessmentRuntime,
  AssessmentRuntimeError,
  applyAssessmentEvidenceLimits,
  assessmentCitations,
  buildAssessmentPrompt,
} from "@/features/website-assessment/application/assessment-runtime"
import {
  assessmentOutputJsonSchema,
  decodeAssessmentOutput,
} from "@/features/website-assessment/domain/assessment-output"

export function makeCodexAssessmentRuntime(
  executable: string,
  runProcess: RuntimeProcess = executeRuntimeProcess,
  version?: string,
): AssessmentRuntime {
  return {
    id: "codex",
    ...(version ? { version } : {}),
    assess: (evidence, configuration) =>
      Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), "open-prospector-assessment-")),
          catch: () =>
            blocked("temporary-directory", "A private assessment workspace could not be created."),
        }),
        (directory) =>
          Effect.gen(function* () {
            const schemaPath = join(directory, "assessment-output.schema.json")
            yield* Effect.tryPromise({
              try: () =>
                writeFile(schemaPath, JSON.stringify(assessmentOutputJsonSchema), {
                  encoding: "utf8",
                  flag: "wx",
                }),
              catch: () => blocked("schema-file", "The assessment schema could not be prepared."),
            })
            const result = yield* runProcess({
              executable,
              arguments: codexArguments(schemaPath, directory, configuration),
              input: buildAssessmentPrompt(evidence),
              cwd: directory,
            }).pipe(Effect.mapError((error) => new AssessmentRuntimeError(error)))
            const parsed = yield* Effect.try({
              try: () => JSON.parse(result.stdout) as unknown,
              catch: () => transient("malformed-output", "The runtime returned malformed JSON."),
            })
            return yield* decodeAssessmentOutput(parsed, assessmentCitations(evidence)).pipe(
              Effect.map((output) => applyAssessmentEvidenceLimits(evidence, output)),
              Effect.mapError((error) => transient(error.code, error.message)),
            )
          }),
        (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
      ),
  }
}

export function codexArguments(
  schemaPath: string,
  directory: string,
  configuration?: Readonly<{ model: string; reasoningEffort: string }>,
): readonly string[] {
  return [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--cd",
    directory,
    "--output-schema",
    schemaPath,
    ...(configuration
      ? [
          "--model",
          configuration.model,
          "--config",
          `model_reasoning_effort=${JSON.stringify(configuration.reasoningEffort)}`,
        ]
      : []),
    "-",
  ]
}

function transient(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Transient", code, message })
}

function blocked(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Blocked", code, message })
}
