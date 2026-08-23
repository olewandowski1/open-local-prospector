import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs"
import { join, resolve, sep } from "node:path"

export function safeRunArtifactsPath(root: string, runId: string): string {
  const target = resolve(root, "inspections", runId)
  const allowedRoot = `${resolve(root, "inspections")}${sep}`
  if (!target.startsWith(allowedRoot)) throw new Error("Unsafe run artifact path.")
  return target
}

export function removeTreeAndCountFailures(path: string): number {
  if (!existsSync(path)) return 0
  try {
    rmSync(path, { recursive: true, force: true })
    return 0
  } catch {
    return countTreeFiles(path)
  }
}

export function countTreeFiles(path: string): number {
  if (!existsSync(path)) return 0
  const stat = lstatSync(path)
  if (!stat.isDirectory()) return 1
  return readdirSync(path).reduce((total, entry) => total + countTreeFiles(join(path, entry)), 0)
}
