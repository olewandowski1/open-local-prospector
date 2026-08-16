import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
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
import {
  executeRuntimeProcess,
  type RuntimeProcess,
  type RuntimeProcessResult,
} from "@/features/website-assessment/infrastructure/direct-runtime-process"

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
    (directory) => ({
      arguments: [
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(assessmentOutputJsonSchema),
        "--tools",
        "",
        "--permission-mode",
        "dontAsk",
        "--no-session-persistence",
        "--safe-mode",
        "--strict-mcp-config",
        "--mcp-config",
        "{}",
      ],
      cwd: directory,
    }),
    parseClaude,
  )
}

export function makeOpenCodeAssessmentRuntime(
  executable: string,
  runProcess: RuntimeProcess = executeRuntimeProcess,
  version?: string,
): AssessmentRuntime {
  return makeRuntime(
    "opencode",
    executable,
    runProcess,
    version,
    (directory) => ({
      arguments: ["run", "--format", "json", "--dir", directory],
      cwd: directory,
      environment: {
        ...process.env,
        OPENCODE_PERMISSION: JSON.stringify({ "*": "deny" }),
        OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
        OPENCODE_DISABLE_CLAUDE_CODE: "true",
        OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
        OPENCODE_DISABLE_MODELS_FETCH: "true",
      },
    }),
    parseOpenCode,
  )
}

function makeRuntime(
  id: "claude" | "opencode",
  executable: string,
  runProcess: RuntimeProcess,
  version: string | undefined,
  command: (
    directory: string,
  ) => Pick<Parameters<RuntimeProcess>[0], "arguments" | "cwd" | "environment">,
  parse: (result: RuntimeProcessResult) => unknown,
): AssessmentRuntime {
  return {
    id,
    ...(version ? { version } : {}),
    assess: (evidence) =>
      Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), `open-local-prospector-${id}-`)),
          catch: () =>
            blocked("temporary-directory", "A private assessment workspace could not be created."),
        }),
        (directory) =>
          Effect.gen(function* () {
            const prompt = `${buildAssessmentPrompt(evidence)}\nThe required JSON Schema is trusted application configuration:\n${JSON.stringify(assessmentOutputJsonSchema)}`
            const result = yield* runProcess({ executable, ...command(directory), input: prompt })
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
function parseOpenCode(result: RuntimeProcessResult): unknown {
  try {
    const direct = JSON.parse(result.stdout) as unknown
    if (!Array.isArray(direct)) return direct
  } catch {
    /* event stream */
  }
  const lines = result.stdout.split(/\r?\n/u).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const event = JSON.parse(lines[index] ?? "{}") as Record<string, unknown>
    const part =
      typeof event.part === "object" && event.part
        ? (event.part as Record<string, unknown>)
        : undefined
    const text =
      typeof part?.text === "string"
        ? part.text
        : typeof event.text === "string"
          ? event.text
          : undefined
    if (text) {
      try {
        return JSON.parse(text)
      } catch {
        /* continue */
      }
    }
  }
  throw new Error("no assessment event")
}
function transient(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Transient", code, message })
}
function blocked(code: string, message: string) {
  return new AssessmentRuntimeError({ classification: "Blocked", code, message })
}
