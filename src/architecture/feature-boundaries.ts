import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export type SourceModule = Readonly<{
  path: string
  source: string
}>

export type BoundaryViolation = Readonly<{
  importer: string
  imported: string
  reason: string
}>

const importSpecifierPattern =
  /(?:\b(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?|\bimport\s*\()\s*["'`]([^"'`]+)["'`]/g

const moduleSpecifiers = (module: SourceModule) =>
  [...module.source.matchAll(importSpecifierPattern)].map((match) => match[1])

const normalized = (path: string) => path.replaceAll("\\", "/")
const isRuntimeAdapterImport = (specifier: string) =>
  /^(?:node:)?(?:child_process|process)$/.test(specifier) ||
  /^(?:@playwright|playwright)(?:\/|$)/.test(specifier) ||
  /sqlite/i.test(specifier)

export function findFeatureBoundaryViolations(modules: readonly SourceModule[]) {
  const violations: BoundaryViolation[] = []

  for (const module of modules) {
    const importer = normalized(module.path)
    const isTest = /\.test\.[cm]?[jt]sx?$/.test(importer)
    const importerFeature = importer.match(/(?:^|\/)src\/features\/([^/]+)\//)?.[1]

    for (const imported of moduleSpecifiers(module)) {
      const targetFeature = imported.match(/^@\/features\/([^/]+)(?:\/(.+))?$/)

      if (importerFeature && targetFeature?.[1] !== importerFeature && targetFeature?.[2]) {
        violations.push({
          importer,
          imported,
          reason: "Cross-feature imports must use the owning feature's public interface.",
        })
      }

      if (
        !isTest &&
        importer.includes("/domain/") &&
        (/^(next|react)(\/|$)/.test(imported) ||
          isRuntimeAdapterImport(imported) ||
          /^@\/features\/[^/]+\/(application|infrastructure|server|presentation)(\/|$)/.test(
            imported,
          ))
      ) {
        violations.push({
          importer,
          imported,
          reason: "Domain modules cannot depend on framework or outer feature layers.",
        })
      }

      if (
        !isTest &&
        importer.includes("/application/") &&
        (/^(next|react)(\/|$)/.test(imported) ||
          isRuntimeAdapterImport(imported) ||
          /^@\/features\/[^/]+\/(infrastructure|server|presentation)(\/|$)/.test(imported))
      ) {
        violations.push({
          importer,
          imported,
          reason: "Application modules cannot depend on framework or adapter layers.",
        })
      }

      if (/(?:^|\/)src\/worker\//.test(importer) && imported.startsWith("@/app")) {
        violations.push({
          importer,
          imported,
          reason: "The worker cannot import the Next.js application adapter.",
        })
      }
    }
  }

  return violations
}

const collectSourceModules = (directory: string): SourceModule[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceModules(path)
    if (![".ts", ".tsx"].includes(extname(entry.name))) return []
    return [{ path: relative(process.cwd(), path), source: readFileSync(path, "utf8") }]
  })

export function checkFeatureBoundaries(root = resolve("src")) {
  return findFeatureBoundaryViolations(collectSourceModules(root))
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined

if (import.meta.url === entryPoint) {
  const violations = checkFeatureBoundaries()
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.importer}: ${violation.imported} — ${violation.reason}`)
    }
    process.exitCode = 1
  }
}
