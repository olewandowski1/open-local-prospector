import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Effect } from "effect"

import {
  buildReportPrompt,
  buildStructurePrompt,
  type DiscoveryBrief,
  type DiscoveryRuntime,
  DiscoveryRuntimeError,
} from "@/features/business-discovery/application/discovery-runtime"
import {
  decodeDiscoveryStructure,
  discoveryStructureJsonSchema,
  MAX_REPORT_CHARACTERS,
} from "@/features/business-discovery/domain/discovery-structure"
import type { RuntimeId } from "@/features/runtime-settings"
import {
  EMPTY_MCP_CONFIG,
  executeRuntimeProcess,
  onlyJsonObject,
  type RuntimeProcess,
  type RuntimeProcessResult,
  supportsReasoningEffort,
  withoutTerminalColour,
} from "@/features/runtime-settings"

/**
 * A report searches the public web and reads the pages it finds, so minutes are normal. OpenCode's
 * hosted model drives its fetches one at a time and is far slower than the others — measured at
 * ninety-seven seconds for three businesses — so it is given room rather than cut off. One number
 * for every runtime would mean either failing OpenCode or letting a hung Claude hold a worker slot
 * for three quarters of an hour.
 */
const REPORT_TIMEOUT_MILLISECONDS: Readonly<Record<RuntimeId, number>> = {
  claude: 900_000,
  codex: 900_000,
  opencode: 2_700_000,
}

const STRUCTURE_TIMEOUT_MILLISECONDS: Readonly<Record<RuntimeId, number>> = {
  claude: 300_000,
  codex: 300_000,
  opencode: 900_000,
}

type RuntimeExecutableMap = Readonly<Partial<Record<RuntimeId, string>>>

export function makeSubscriptionDiscoveryRuntime(
  executables: RuntimeExecutableMap,
  runProcess: RuntimeProcess = executeRuntimeProcess,
): DiscoveryRuntime {
  return {
    identifier: "subscription-runtime-search-then-structure",
    report: (brief) =>
      withExecutable(executables, brief, (executable) =>
        inTemporaryDirectory((directory) =>
          Effect.gen(function* () {
            const result = yield* runProcess({
              executable,
              ...reportCommand(brief, directory),
              input: buildReportPrompt(brief),
              timeoutMilliseconds: REPORT_TIMEOUT_MILLISECONDS[brief.runtime],
            }).pipe(Effect.mapError(processError))
            const report = yield* Effect.try({
              try: () => readReportText(brief.runtime, result),
              catch: () => invalidOutput("The runtime did not return a readable search report."),
            })
            if (report.trim().length === 0) {
              return yield* Effect.fail(invalidOutput("The search report was empty."))
            }
            return report.slice(0, MAX_REPORT_CHARACTERS)
          }),
        ),
      ),
    structure: (brief, report) =>
      withExecutable(executables, brief, (executable) =>
        inTemporaryDirectory((directory) =>
          Effect.gen(function* () {
            const command = yield* structureCommand(brief, directory)
            const result = yield* runProcess({
              executable,
              ...command,
              input: buildStructurePrompt(brief, report, {
                schema: brief.runtime === "opencode" ? promptSchema : undefined,
              }),
              timeoutMilliseconds: STRUCTURE_TIMEOUT_MILLISECONDS[brief.runtime],
            }).pipe(Effect.mapError(processError))
            const raw = yield* Effect.try({
              try: () => parseStructuredOutput(brief.runtime, result),
              catch: () => invalidOutput("The runtime output was not the required JSON object."),
            })
            return yield* decodeDiscoveryStructure(raw).pipe(
              Effect.mapError((error) => invalidOutput(error.message, error.code)),
            )
          }),
        ),
      ),
  }
}

/** Searching needs the web-search tool and no output schema; a schema here costs report quality. */
function reportCommand(brief: DiscoveryBrief, directory: string) {
  if (brief.runtime === "opencode") {
    return {
      arguments: ["run", ...opencodeModelArguments(brief), "--dir", directory],
      cwd: directory,
      // OpenCode answers and exits, but a helper keeps the stdio pipes open; settle on exit.
      settleOnExitMilliseconds: 2_000,
    }
  }
  if (brief.runtime === "codex") {
    return {
      arguments: [
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
        ...modelArguments(brief),
        "--config",
        'web_search="live"',
        "-",
      ],
      cwd: directory,
    }
  }
  return {
    arguments: [
      "-p",
      ...claudeModelArguments(brief),
      "--tools",
      "WebSearch",
      "--allowedTools",
      "WebSearch",
      "--permission-mode",
      "dontAsk",
      "--no-session-persistence",
      "--safe-mode",
      "--strict-mcp-config",
      "--mcp-config",
      EMPTY_MCP_CONFIG,
    ],
    cwd: directory,
  }
}

/** Spelled out for a runtime that cannot be handed a schema file. */
const promptSchema = JSON.stringify(discoveryStructureJsonSchema, null, 1)

/** Structuring reads the report it is given and nothing else, so every tool is withdrawn. */
function structureCommand(brief: DiscoveryBrief, directory: string) {
  if (brief.runtime === "opencode") {
    // OpenCode exposes no flag to withdraw tools, so the prompt's instruction plus the contract
    // verifier carry the containment: anything not written down in the report is dropped.
    return Effect.succeed({
      arguments: ["run", ...opencodeModelArguments(brief), "--dir", directory],
      cwd: directory,
      settleOnExitMilliseconds: 2_000,
    })
  }
  if (brief.runtime === "codex") {
    const schemaPath = join(directory, "discovery-structure.schema.json")
    return Effect.tryPromise({
      try: async () => {
        await writeFile(schemaPath, JSON.stringify(discoveryStructureJsonSchema), {
          encoding: "utf8",
          flag: "wx",
        })
        return {
          arguments: [
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
            ...modelArguments(brief),
            "-",
          ],
          cwd: directory,
        }
      },
      catch: () => blocked("schema-file", "The discovery schema could not be prepared."),
    })
  }
  return Effect.succeed({
    arguments: [
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(discoveryStructureJsonSchema),
      ...claudeModelArguments(brief),
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
  })
}

function modelArguments(brief: DiscoveryBrief): readonly string[] {
  if (!brief.runtimeConfiguration) return []
  return [
    "--model",
    brief.runtimeConfiguration.model,
    "--config",
    `model_reasoning_effort=${JSON.stringify(brief.runtimeConfiguration.reasoningEffort)}`,
  ]
}

function claudeModelArguments(brief: DiscoveryBrief): readonly string[] {
  if (!brief.runtimeConfiguration) return []
  return [
    "--model",
    brief.runtimeConfiguration.model,
    ...(supportsReasoningEffort("claude", brief.runtimeConfiguration.model)
      ? ["--effort", brief.runtimeConfiguration.reasoningEffort]
      : []),
  ]
}

/** OpenCode calls the reasoning effort a model variant. */
function opencodeModelArguments(brief: DiscoveryBrief): readonly string[] {
  if (!brief.runtimeConfiguration) return []
  const { model, reasoningEffort } = brief.runtimeConfiguration
  return ["-m", model, ...(reasoningEffort === "none" ? [] : ["--variant", reasoningEffort])]
}

/** The report call asks for prose, so stdout is the report unless a runtime wraps it in JSON. */
export function readReportText(runtime: RuntimeId, result: RuntimeProcessResult): string {
  if (runtime !== "opencode") {
    try {
      const wrapper = JSON.parse(result.stdout) as Record<string, unknown>
      if (typeof wrapper.result === "string") return wrapper.result
    } catch {
      // Plain text is the expected shape; only a wrapped runtime needs unwrapping.
    }
    return result.stdout
  }
  return withoutTerminalColour(result.stdout)
}

export function parseStructuredOutput(runtime: RuntimeId, result: RuntimeProcessResult): unknown {
  if (runtime === "codex") return JSON.parse(result.stdout)
  if (runtime === "opencode") {
    return JSON.parse(onlyJsonObject(withoutTerminalColour(result.stdout)))
  }
  const wrapper = JSON.parse(result.stdout) as Record<string, unknown>
  if (wrapper.structured_output) return wrapper.structured_output
  if (typeof wrapper.result === "string") return JSON.parse(wrapper.result)
  return wrapper
}

function withExecutable<A>(
  executables: RuntimeExecutableMap,
  brief: DiscoveryBrief,
  use: (executable: string) => Effect.Effect<A, DiscoveryRuntimeError>,
): Effect.Effect<A, DiscoveryRuntimeError> {
  const executable = executables[brief.runtime]
  if (!executable) {
    return Effect.fail(blocked("runtime-unavailable", "The selected runtime is unavailable."))
  }
  return use(executable)
}

function inTemporaryDirectory<A>(
  use: (directory: string) => Effect.Effect<A, DiscoveryRuntimeError>,
): Effect.Effect<A, DiscoveryRuntimeError> {
  return Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), "open-local-prospector-discovery-")),
      catch: () => blocked("temporary-directory", "A private workspace could not be created."),
    }),
    use,
    // A runtime that leaves a helper behind still holds this directory open, and Windows answers
    // EBUSY. Losing a scratch directory in the system temp folder is not worth failing a run for.
    (directory) =>
      Effect.promise(() =>
        rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(
          () => undefined,
        ),
      ),
  )
}

function processError(error: {
  classification: "Transient" | "Permanent" | "Blocked" | "Infrastructure"
  code: string
  message: string
}): DiscoveryRuntimeError {
  return new DiscoveryRuntimeError(error)
}

function blocked(code: string, message: string): DiscoveryRuntimeError {
  return new DiscoveryRuntimeError({ classification: "Blocked", code, message })
}

function invalidOutput(message: string, code = "invalid-runtime-output"): DiscoveryRuntimeError {
  return new DiscoveryRuntimeError({ classification: "Transient", code, message })
}
