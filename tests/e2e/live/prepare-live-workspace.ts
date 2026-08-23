import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"

import { migrateLocalDatabase } from "@/features/local-application"

const workspace = resolve(".scratch/live-e2e")
rmSync(workspace, { recursive: true, force: true })
mkdirSync(resolve(workspace, "artifacts"), { recursive: true })
migrateLocalDatabase(resolve(workspace, "workspace.sqlite"))
