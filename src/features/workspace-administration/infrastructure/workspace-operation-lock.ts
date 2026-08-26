import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname } from "node:path"

import { closeSharedDatabases, type LocalApplicationConfig } from "@/features/local-application"

const lockPathFor = (databasePath: string) => `${databasePath}.maintenance.lock`

// The worker takes this for every cycle, so the lock existing says nothing about maintenance.
type LockHolder = "maintenance" | "worker"

type LockFile = Readonly<{ pid?: unknown; holder?: unknown; ownerId?: unknown }>

const LOCK_INITIALIZATION_GRACE_MS = 30_000

export function isWorkspaceMaintenanceActive(databasePath: string): boolean {
  return readLock(lockPathFor(databasePath))?.holder === "maintenance"
}

export function withWorkspaceOperationLock<T>(config: LocalApplicationConfig, work: () => T): T {
  const release = tryAcquireWorkspaceOperationLease(config.databasePath, "maintenance")
  if (!release) throw new Error("Workspace maintenance is already in progress.")
  // Windows will not rename a file this process still holds open, so pooled handles are released first.
  closeSharedDatabases()
  try {
    const result = work()
    if (result instanceof Promise) return result.finally(release) as T
    release()
    return result
  } catch (error) {
    release()
    throw error
  }
}

export function tryAcquireWorkspaceOperationLease(
  databasePath: string,
  holder: LockHolder = "worker",
): (() => void) | undefined {
  const lockPath = lockPathFor(databasePath)
  mkdirSync(dirname(lockPath), { recursive: true })
  let descriptor = tryAcquire(lockPath)
  if (descriptor === undefined && isStale(lockPath)) {
    rmSync(lockPath, { force: true })
    descriptor = tryAcquire(lockPath)
  }
  if (descriptor === undefined) return undefined
  const ownerId = crypto.randomUUID()
  let released = false
  const release = () => {
    if (released) return
    released = true
    closeSync(descriptor)
    if (readLock(lockPath)?.ownerId === ownerId) rmSync(lockPath, { force: true })
  }
  try {
    writeFileSync(
      descriptor,
      JSON.stringify({ pid: process.pid, holder, ownerId, createdAt: new Date().toISOString() }),
    )
    return release
  } catch (error) {
    released = true
    closeSync(descriptor)
    rmSync(lockPath, { force: true })
    throw error
  }
}

function tryAcquire(path: string): number | undefined {
  try {
    return openSync(path, "wx")
  } catch {
    return undefined
  }
}

function readLock(path: string): LockFile | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LockFile
  } catch {
    return undefined
  }
}

function isStale(path: string): boolean {
  const lock = readLock(path)
  if (!lock || typeof lock.pid !== "number" || !Number.isInteger(lock.pid)) {
    try {
      return Date.now() - statSync(path).mtimeMs >= LOCK_INITIALIZATION_GRACE_MS
    } catch {
      return false
    }
  }
  try {
    process.kill(lock.pid, 0)
    return false
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH"
  }
}
