import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { closeSharedDatabases, migrateLocalDatabase } from "@/features/local-application"

export function createMigratedTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "prospector-test-"))
  const path = join(directory, "prospector.sqlite")
  migrateLocalDatabase(path)
  return {
    path,
    // A held-open connection makes the file unremovable on Windows, which answers EBUSY.
    cleanup: () => {
      closeSharedDatabases()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}
