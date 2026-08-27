import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import {
  describeUnreadableOutput,
  EMPTY_MCP_CONFIG,
  executeRuntimeProcess,
  onlyJsonObject,
  openCodeRuntimePolicy,
  type RuntimeProcess,
  type RuntimeProcessResult,
  supportsReasoningEffort,
  withoutTerminalColour,
} from "@/features/runtime-settings"
import {
  type AssessmentRuntime,
  AssessmentRuntimeError,
  assessmentCitations,
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
    (directory, configuration) => {
      const policy = openCodeRuntimePolicy("no-tools")
      return {
        // OpenCode calls the reasoning effort a model variant.
        arguments: [
          "run",
          ...policy.arguments,
          ...(configuration ? ["-m", configuration.model] : []),
          ...(configuration && configuration.reasoningEffort !== "none"
            ? ["--variant", configuration.reasoningEffort]
            : []),
          "--dir",
          directory,
        ],
        cwd: directory,
        environment: policy.environment,
        // The hosted model drives its work one step at a time; the default two minutes cuts it off.
        timeoutMilliseconds: 900_000,
        // OpenCode answers and exits, but a helper keeps the stdio pipes open; settle on exit.
        settleOnExitMilliseconds: 2_000,
      }
    },
    // OpenCode wraps answers in terminal banners and tool traces.
    (result) => JSON.parse(onlyJsonObject(withoutTerminalColour(result.stdout))),
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
    "arguments" | "cwd" | "environment" | "settleOnExitMilliseconds" | "timeoutMilliseconds"
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
                transient(
                  "malformed-output",
                  `The runtime returned structured output that could not be read: ${describeUnreadableOutput(result.stdout)}.`,
                ),
            })
            return yield* decodeAssessmentOutput(raw, assessmentCitations(evidence)).pipe(
              Effect.mapError((error) => transient(error.code, error.message)),
            )
          }),
        // Ignore Windows EBUSY when a runtime helper retains the disposable directory.
        (directory) =>
          Effect.promise(() =>
            rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(
              () => undefined,
            ),
          ),
      ),
  }
}

function parseClaude(result: RuntimeProcessResult): unknown {
  const wrapper = JSON.parse(result.stdout) as Record<string, unknown>
  if (wrapper.structured_output) return wrapper.structured_output
  if (typeof wrapper.result === "string") return JSON.parse(wrapper.result)
  return wrapper
}

function transient(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Transient", code, message })
}
function blocked(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Blocked", code, message })
}
