import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ databasePath: "" }))
vi.mock("@/features/local-application", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/local-application")>()),
  loadLocalApplicationConfig: () => ({ databasePath: state.databasePath }),
}))

import { GET } from "@/app/api/export/route"
import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

let directory = ""

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "prospector-export-route-"))
  state.databasePath = join(directory, "workspace.sqlite")
  seedE2eWorkspace(state.databasePath)
})

afterAll(() => rmSync(directory, { recursive: true, force: true }))

describe("candidate export route", () => {
  it("returns every candidate by default as a private attachment", async () => {
    const response = GET(new Request("http://localhost/api/export?format=json"))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-disposition")).toContain("attachment")
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect((await response.json()) as readonly unknown[]).not.toHaveLength(0)
  })
})
