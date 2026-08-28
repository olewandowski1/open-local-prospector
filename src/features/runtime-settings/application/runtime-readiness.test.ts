import { Effect, Layer, Option } from "effect"
import { describe, expect, it, vi } from "vitest"

import {
  getRuntimeReadiness,
  RuntimeCommandError,
  type RuntimeCommandResult,
  type RuntimeId,
  RuntimeProbe,
  type RuntimeProbeService,
  type RuntimeReadinessStatus,
} from "@/features/runtime-settings/application/runtime-readiness"

const readyAuthentication: Record<RuntimeId, RuntimeCommandResult> = {
  codex: { exitCode: 0, stdout: "Logged in using ChatGPT", stderr: "" },
  claude: {
    exitCode: 0,
    stdout: JSON.stringify({
      loggedIn: true,
      authMethod: "claude.ai",
      apiProvider: "firstParty",
      subscriptionType: "pro",
    }),
    stderr: "",
  },
  opencode: { exitCode: 0, stdout: "0 credentials", stderr: "" },
}

const loggedOutAuthentication: Record<RuntimeId, RuntimeCommandResult> = {
  codex: { exitCode: 1, stdout: "Not logged in", stderr: "" },
  claude: { exitCode: 0, stdout: JSON.stringify({ loggedIn: false }), stderr: "" },
  opencode: { exitCode: 0, stdout: "0 credentials", stderr: "" },
}

const versionOutput: Record<RuntimeId, string> = {
  codex: "codex-cli 0.99.0",
  claude: "2.4.1 (Claude Code)",
  opencode: "1.18.21 (opencode)",
}

function runProbe(runtimeId: RuntimeId, service: RuntimeProbeService) {
  return Effect.runPromise(
    getRuntimeReadiness(runtimeId).pipe(Effect.provide(Layer.succeed(RuntimeProbe, service))),
  )
}

function serviceFor(runtimeId: RuntimeId, state: RuntimeReadinessStatus): RuntimeProbeService {
  if (state === "Missing") {
    return {
      resolveExecutable: () => Effect.succeed(Option.none()),
      execute: () => Effect.die("should not execute"),
    }
  }

  let call = 0
  return {
    resolveExecutable: () => Effect.succeed(Option.some(`/bin/${runtimeId}`)),
    execute: () => {
      call += 1
      if (state === "Unreachable" && call === 1) {
        return Effect.fail(new RuntimeCommandError({ reason: "timeout" }))
      }
      if (call === 1) {
        return Effect.succeed({
          exitCode: 0,
          stdout: state === "Unsupported Version" ? "0.0.1" : versionOutput[runtimeId],
          stderr: "",
        })
      }
      return Effect.succeed(
        state === "Logged Out"
          ? loggedOutAuthentication[runtimeId]
          : readyAuthentication[runtimeId],
      )
    },
  }
}

describe.each(["codex", "claude"] as const)("%s runtime readiness", (runtimeId) => {
  it.each(["Ready", "Missing", "Logged Out", "Unreachable", "Unsupported Version"] as const)(
    "classifies %s deterministically",
    async (status) => {
      const result = await runProbe(runtimeId, serviceFor(runtimeId, status))

      expect(result.status).toBe(status)
      expect(result.runtimeId).toBe(runtimeId)
    },
  )

  it("uses only the adapter's fixed status and version arguments", async () => {
    const execute = vi
      .fn<RuntimeProbeService["execute"]>()
      .mockReturnValueOnce(
        Effect.succeed({ exitCode: 0, stdout: versionOutput[runtimeId], stderr: "" }),
      )
      .mockReturnValueOnce(Effect.succeed(readyAuthentication[runtimeId]))

    await runProbe(runtimeId, {
      resolveExecutable: () => Effect.succeed(Option.some(`/bin/${runtimeId}`)),
      execute,
    })

    const expectedAuthenticationArguments = {
      codex: ["login", "status"],
      claude: ["auth", "status", "--json"],
    }[runtimeId]
    expect(execute).toHaveBeenNthCalledWith(1, `/bin/${runtimeId}`, ["--version"])
    expect(execute).toHaveBeenNthCalledWith(2, `/bin/${runtimeId}`, expectedAuthenticationArguments)
  })
})

describe("opencode runtime readiness", () => {
  it.each(["Ready", "Missing", "Unreachable", "Unsupported Version"] as const)(
    "classifies %s deterministically",
    async (status) => {
      const result = await runProbe("opencode", serviceFor("opencode", status))

      expect(result.status).toBe(status)
      expect(result.runtimeId).toBe("opencode")
    },
  )

  // The hosted catalog answers without a provider login, so credentials never gate readiness.
  it("is ready with zero credentials and can never report Logged Out", async () => {
    const ready = await runProbe("opencode", serviceFor("opencode", "Ready"))
    expect(ready.status).toBe("Ready")
    // Ready means nothing is asked of the reader; the optional login stays out of the way.
    expect(ready.detail).toBe("Hosted catalog available; provider login optional.")
    expect(ready.terminalInstruction).toBeUndefined()

    const loggedOut = await runProbe("opencode", serviceFor("opencode", "Logged Out"))
    expect(loggedOut.status).toBe("Ready")
  })

  it("reports Unsupported Version when the credential listing fails", async () => {
    let call = 0
    const result = await runProbe("opencode", {
      resolveExecutable: () => Effect.succeed(Option.some("/bin/opencode")),
      execute: () => {
        call += 1
        return Effect.succeed(
          call === 1
            ? { exitCode: 0, stdout: versionOutput.opencode, stderr: "" }
            : { exitCode: 1, stdout: "", stderr: "unknown command" },
        )
      },
    })

    expect(result.status).toBe("Unsupported Version")
  })

  it("uses only the adapter's fixed status and version arguments", async () => {
    const execute = vi
      .fn<RuntimeProbeService["execute"]>()
      .mockReturnValueOnce(
        Effect.succeed({ exitCode: 0, stdout: versionOutput.opencode, stderr: "" }),
      )
      .mockReturnValueOnce(Effect.succeed(readyAuthentication.opencode))

    await runProbe("opencode", {
      resolveExecutable: () => Effect.succeed(Option.some("/bin/opencode")),
      execute,
    })

    expect(execute).toHaveBeenNthCalledWith(1, "/bin/opencode", ["--version"])
    expect(execute).toHaveBeenNthCalledWith(2, "/bin/opencode", ["providers", "list"])
  })
})

it("returns only readiness metadata from provider status output", async () => {
  const result = await runProbe("claude", serviceFor("claude", "Ready"))

  expect(JSON.stringify(result)).not.toContain("subscriptionType")
})

// The CLI adding analyticsDisabled and projectsDirectory had disabled the runtime altogether.
it("accepts a status response carrying a field it does not read", async () => {
  let call = 0
  const result = await runProbe("claude", {
    resolveExecutable: () => Effect.succeed(Option.some("/bin/claude")),
    execute: () => {
      call += 1
      return Effect.succeed(
        call === 1
          ? { exitCode: 0, stdout: versionOutput.claude, stderr: "" }
          : {
              exitCode: 0,
              stdout: JSON.stringify({
                loggedIn: true,
                subscriptionType: "pro",
                analyticsDisabled: false,
                projectsDirectory: "/home/user/.claude/projects",
              }),
              stderr: "",
            },
      )
    },
  })

  expect(result.status).toBe("Ready")
})

it("refuses a status response that carries a credential", async () => {
  let call = 0
  const result = await runProbe("claude", {
    resolveExecutable: () => Effect.succeed(Option.some("/bin/claude")),
    execute: () => {
      call += 1
      return Effect.succeed(
        call === 1
          ? { exitCode: 0, stdout: versionOutput.claude, stderr: "" }
          : {
              exitCode: 0,
              stdout: JSON.stringify({
                loggedIn: true,
                subscriptionType: "pro",
                refreshToken: "secret-value",
              }),
              stderr: "",
            },
      )
    },
  })

  expect(result.status).toBe("Unsupported Version")
})
