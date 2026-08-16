import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>
}

describe("Local Application scripts", () => {
  it.each(["dev:web", "start"])("binds %s to the loopback-only application address", (script) => {
    expect(packageJson.scripts[script]).toContain("--hostname 127.0.0.1")
    expect(packageJson.scripts[script]).toContain("--port 4310")
  })

  it("starts the web and worker as separate development processes", () => {
    expect(packageJson.scripts.dev).toContain("pnpm dev:web")
    expect(packageJson.scripts.dev).toContain("pnpm dev:worker")
  })
})
