import { describe, expect, it } from "vitest"
import {
  runtimeDescriptor,
  runtimeIds,
} from "@/features/runtime-settings/application/runtime-readiness"
import {
  compareVersions,
  isUpdateAvailable,
  RUNTIME_PACKAGES,
  terminalCommand,
} from "@/features/runtime-settings/application/runtime-update"

describe("compareVersions", () => {
  it("orders by each numeric segment in turn", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1)
    expect(compareVersions("1.9.9", "2.0.0")).toBe(-1)
    expect(compareVersions("0.147.0", "0.146.9")).toBe(1)
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0)
  })

  it("compares numerically rather than as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1)
    expect(compareVersions("2.1.234", "2.1.99")).toBe(1)
  })

  it("treats missing trailing segments as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0)
    expect(compareVersions("1.2.1", "1.2")).toBe(1)
  })

  it("refuses to rank versions it cannot read", () => {
    expect(compareVersions("nightly", "1.0.0")).toBe(0)
    expect(compareVersions("1.0.0", "")).toBe(0)
  })
})

describe("isUpdateAvailable", () => {
  it("reports an update only when the published version is higher", () => {
    expect(isUpdateAvailable("0.146.0", "0.147.0")).toBe(true)
    expect(isUpdateAvailable("0.147.0", "0.147.0")).toBe(false)
    expect(isUpdateAvailable("0.148.0", "0.147.0")).toBe(false)
  })

  it("claims nothing when either version could not be read", () => {
    expect(isUpdateAvailable(undefined, "1.0.0")).toBe(false)
    expect(isUpdateAvailable("1.0.0", undefined)).toBe(false)
    expect(isUpdateAvailable(undefined, undefined)).toBe(false)
  })

  it("claims nothing when a version is unreadable, rather than guessing", () => {
    expect(isUpdateAvailable("dev", "1.0.0")).toBe(false)
  })
})

describe("RUNTIME_PACKAGES", () => {
  it("names a published package for every supported runtime", () => {
    // OpenCode publishes unscoped; Codex and Claude publish under their organisations.
    const npmPackageName = /^(@[\w-]+\/)?[\w.-]+$/u
    for (const runtimeId of runtimeIds) {
      expect(RUNTIME_PACKAGES[runtimeId]).toMatch(npmPackageName)
    }
  })
})

describe("runtimeDescriptor", () => {
  it("offers a manual command for every runtime, so a failed self-update stays recoverable", () => {
    for (const runtimeId of runtimeIds) {
      const descriptor = runtimeDescriptor(runtimeId)
      expect(descriptor.updateInstruction.trim()).not.toBe("")
      expect(descriptor.installInstruction.trim()).not.toBe("")
    }
  })
})

describe("terminalCommand", () => {
  it("drops the prose prefix so the command pastes into a terminal unaltered", () => {
    expect(terminalCommand("Run: npm update -g @openai/codex")).toBe("npm update -g @openai/codex")
  })

  it("is case- and whitespace-insensitive about the prefix", () => {
    expect(terminalCommand("run:   npm update -g @openai/codex  ")).toBe(
      "npm update -g @openai/codex",
    )
  })

  it("leaves an instruction that is already a bare command untouched", () => {
    expect(terminalCommand("npm update -g @openai/codex")).toBe("npm update -g @openai/codex")
  })

  it("only strips a leading prefix, never one appearing later", () => {
    expect(terminalCommand("npm run: build")).toBe("npm run: build")
  })
})
