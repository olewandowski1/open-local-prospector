import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname } from "node:path"

import type { LocalApplicationConfig } from "@/features/local-application"

const lockPathFor = (databasePath: string) => `${databasePath}.maintenance.lock`

export function isWorkspaceMaintenanceActive(databasePath: string): boolean {
  return existsSync(lockPathFor(databasePath))
}

export function withWorkspaceOperationLock<T>(config: LocalApplicationConfig, work: () => T): T {
  const release = tryAcquireWorkspaceOperationLease(config.databasePath)
  if (!release) throw new Error("Workspace maintenance is already in progress.")
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

export function tryAcquireWorkspaceOperationLease(databasePath: string): (() => void) | undefined {
  const lockPath = lockPathFor(databasePath)
  mkdirSync(dirname(lockPath), { recursive: true })
  let descriptor = tryAcquire(lockPath)
  if (descriptor === undefined && isStale(lockPath)) {
    rmSync(lockPath, { force: true })
    descriptor = tryAcquire(lockPath)
  }
  if (descriptor === undefined) return undefined
  let released = false
  const release = () => {
    if (released) return
    released = true
    closeSync(descriptor)
    rmSync(lockPath, { force: true })
  }
  try {
    writeFileSync(
      descriptor,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    )
    return release
  } catch (error) {
    release()
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

function isStale(path: string): boolean {
  try {
    const lock = JSON.parse(readFileSync(path, "utf8")) as { pid?: unknown }
    if (typeof lock.pid !== "number" || !Number.isInteger(lock.pid)) return true
    try {
      process.kill(lock.pid, 0)
      return false
    } catch {
      return true
    }
  } catch {
    return true
  }
}
