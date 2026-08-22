import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import {
  EMPTY_MCP_CONFIG,
  executeRuntimeProcess,
  type RuntimeProcess,
  type RuntimeProcessResult,
  supportsReasoningEffort,
} from "@/features/runtime-settings"
import {
  type AssessmentRuntime,
  AssessmentRuntimeError,
  assessmentSourceUrls,
  buildAssessmentPrompt,
} from "@/features/website-assessment/application/assessment-runtime"
import {
  assessmentOutputJsonSchema,
  decodeAssessmentOutput,
} from "@/features/website-assessment/domain/assessment-output"

export function makeClaudeAssessmentRuntime(
  executable: string,
  runProcess: RuntimeProcess = executeRuntimeProcess,
  version?: string,
): AssessmentRuntime {
  return makeRuntime(
    "claude",
    executable,
    runProcess,
    version,
    (directory, configuration) => ({
      arguments: [
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(assessmentOutputJsonSchema),
        ...(configuration ? ["--model", configuration.model] : []),
        ...(configuration && supportsReasoningEffort("claude", configuration.model)
          ? ["--effort", configuration.reasoningEffort]
          : []),
        "--tools",
        "",
        "--permission-mode",
        "dontAsk",
        "--no-session-persistence",
        "--safe-mode",
        "--strict-mcp-config",
        "--mcp-config",
        EMPTY_MCP_CONFIG,
      ],
      cwd: directory,
    }),
    parseClaude,
  )
}

export function makeOpencodeAssessmentRuntime(
  executable: string,
  runProcess: RuntimeProcess = executeRuntimeProcess,
  version?: string,
): AssessmentRuntime {
  return makeRuntime(
    "opencode",
    executable,
    runProcess,
    version,
    (directory, configuration) => ({
      // OpenCode calls the reasoning effort a model variant.
      arguments: [
        "run",
        ...(configuration ? ["-m", configuration.model] : []),
        ...(configuration && configuration.reasoningEffort !== "none"
          ? ["--variant", configuration.reasoningEffort]
          : []),
        "--dir",
        directory,
      ],
      cwd: directory,
      // OpenCode answers and exits, but a helper keeps the stdio pipes open; settle on exit.
      settleOnExitMilliseconds: 2_000,
    }),
    (result) => JSON.parse(stripCodeFence(result.stdout)),
  )
}

function makeRuntime(
  id: AssessmentRuntime["id"],
  executable: string,
  runProcess: RuntimeProcess,
  version: string | undefined,
  command: (
    directory: string,
    configuration?: Readonly<{ model: string; reasoningEffort: string }>,
  ) => Pick<
    Parameters<RuntimeProcess>[0],
    "arguments" | "cwd" | "environment" | "settleOnExitMilliseconds"
  >,
  parse: (result: RuntimeProcessResult) => unknown,
): AssessmentRuntime {
  return {
    id,
    ...(version ? { version } : {}),
    assess: (evidence, configuration) =>
      Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), `open-local-prospector-${id}-`)),
          catch: () =>
            blocked("temporary-directory", "A private assessment workspace could not be created."),
        }),
        (directory) =>
          Effect.gen(function* () {
            const prompt = `${buildAssessmentPrompt(evidence)}\nThe required JSON Schema is trusted application configuration:\n${JSON.stringify(assessmentOutputJsonSchema)}`
            const result = yield* runProcess({
              executable,
              ...command(directory, configuration),
              input: prompt,
            }).pipe(Effect.mapError((error) => new AssessmentRuntimeError(error)))
            const raw = yield* Effect.try({
              try: () => parse(result),
              catch: () =>
                transient("malformed-output", "The runtime returned malformed structured output."),
            })
            return yield* decodeAssessmentOutput(raw, assessmentSourceUrls(evidence)).pipe(
              Effect.mapError((error) => transient(error.code, error.message)),
            )
          }),
        (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
      ),
  }
}

function parseClaude(result: RuntimeProcessResult): unknown {
  const wrapper = JSON.parse(result.stdout) as Record<string, unknown>
  if (wrapper.structured_output) return wrapper.structured_output
  if (typeof wrapper.result === "string") return JSON.parse(wrapper.result)
  return wrapper
}

/** OpenCode has no schema flag, so it answers in prose fences; the object inside is the answer. */
function stripCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/u)
  return fenced ? fenced[1] : text
}
function transient(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Transient", code, message })
}
function blocked(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Blocked", code, message })
}
