import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"

import { seedE2eWorkspace } from "@/test-support/e2e-workspace"

// Seed before the web server opens the database.
const workspace = resolve(process.env.PROSPECTOR_E2E_WORKSPACE ?? ".scratch/e2e")
rmSync(workspace, { recursive: true, force: true })
mkdirSync(resolve(workspace, "artifacts"), { recursive: true })
seedE2eWorkspace(resolve(workspace, "workspace.sqlite"))
