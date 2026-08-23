import { beforeEach, describe, expect, it, vi } from "vitest"

const { updateRuntime } = vi.hoisted(() => ({ updateRuntime: vi.fn() }))

vi.mock("@/features/runtime-settings/server/runtime-update-service", () => ({ updateRuntime }))

import { POST } from "@/app/api/runtimes/[runtimeId]/update/route"

describe("runtime update route", () => {
  beforeEach(() => updateRuntime.mockReset())

  it("rejects a foreign browser Origin before launching the runtime updater", async () => {
    await expect(
      POST(
        new Request("http://127.0.0.1:4310/api/runtimes/codex/update", {
          method: "POST",
          headers: { host: "127.0.0.1:4310", origin: "https://attacker.example" },
        }),
        { params: Promise.resolve({ runtimeId: "codex" }) },
      ),
    ).rejects.toThrow("Cross-origin request refused.")
    expect(updateRuntime).not.toHaveBeenCalled()
  })
})
