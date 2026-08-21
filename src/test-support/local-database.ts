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
    // Repositories hold their connection open for the life of the process, so the file cannot be
    // removed while one is still attached — Windows answers EBUSY. Production releases them the same
    // way before maintenance renames or empties the database.
    cleanup: () => {
      closeSharedDatabases()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}
