import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>
}

describe("Local Application scripts", () => {
  it.each(["dev:web", "start:web"])(
    "binds %s to the loopback-only application address",
    (script) => {
      expect(packageJson.scripts[script]).toContain("--hostname 127.0.0.1")
      expect(packageJson.scripts[script]).toContain("--port 4310")
    },
  )

  it.each(["dev", "start"])("starts %s as separate web and worker processes", (script) => {
    expect(packageJson.scripts[script]).toContain(`pnpm ${script}:web`)
    expect(packageJson.scripts[script]).toContain(`pnpm ${script}:worker`)
  })

  it("watches for changes in the development worker only", () => {
    expect(packageJson.scripts["dev:worker"]).toContain("--watch")
    expect(packageJson.scripts["start:worker"]).not.toContain("--watch")
  })

  it("builds before serving the production application", () => {
    expect(packageJson.scripts.app).toContain("pnpm build")
    expect(packageJson.scripts.app).toContain("pnpm start")
  })
})
