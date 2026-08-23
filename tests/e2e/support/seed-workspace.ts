import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"

import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

// Runs as the first half of the `webServer` command rather than as Playwright's `globalSetup`,
// because Playwright starts the server first and the server opens the database immediately.
const workspace = resolve(process.env.PROSPECTOR_E2E_WORKSPACE ?? ".scratch/e2e")
rmSync(workspace, { recursive: true, force: true })
mkdirSync(resolve(workspace, "artifacts"), { recursive: true })
seedE2eWorkspace(resolve(workspace, "workspace.sqlite"))
