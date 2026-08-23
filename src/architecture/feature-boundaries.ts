import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { parse } from "@babel/parser"

export type SourceModule = Readonly<{
  path: string
  source: string
}>

export type BoundaryViolation = Readonly<{
  importer: string
  imported: string
  reason: string
}>

type ModuleDependency = Readonly<{ specifier: string; typeOnly: boolean }>

const moduleDependencies = (module: SourceModule): ModuleDependency[] => {
  const dependencies: ModuleDependency[] = []
  const ast = parse(module.source, {
    sourceType: "unambiguous",
    plugins: ["typescript", ...(module.path.endsWith("x") ? (["jsx"] as const) : [])],
  })
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      for (const child of value) visit(child)
      return
    }
    const node = value as Record<string, unknown>
    const source = node.source as { type?: string; value?: unknown } | undefined
    if (
      ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(
        String(node.type),
      ) &&
      source?.type === "StringLiteral" &&
      typeof source.value === "string"
    ) {
      dependencies.push({
        specifier: source.value,
        typeOnly: node.importKind === "type" || node.exportKind === "type",
      })
    } else if (node.type === "ImportExpression") {
      const imported = node.source as { type?: string; value?: unknown }
      if (imported?.type === "StringLiteral" && typeof imported.value === "string") {
        dependencies.push({ specifier: imported.value, typeOnly: false })
      }
    }
    for (const [key, child] of Object.entries(node)) {
      if (!["loc", "start", "end", "extra"].includes(key)) visit(child)
    }
  }
  visit(ast.program)
  return dependencies
}

const normalized = (path: string) => path.replaceAll("\\", "/")
const featureLayer = (path: string) =>
  path.match(
    /(?:^|\/)src\/features\/[^/]+\/(domain|application|infrastructure|server|presentation)(?:\/|$)/,
  )?.[1]
const importedFeatureLayer = (specifier: string) =>
  specifier.match(
    /^@\/features\/[^/]+\/(domain|application|infrastructure|server|presentation)(?:\/|$)/,
  )?.[1]

const forbiddenLayerDependencies: Readonly<Record<string, readonly string[]>> = {
  domain: ["application", "infrastructure", "server", "presentation"],
  application: ["infrastructure", "server", "presentation"],
  infrastructure: ["server", "presentation"],
  server: ["presentation"],
  // A presentation module may be a Next.js Server Component that composes its feature's server
  // read model. It must not reach through that boundary to persistence adapters.
  presentation: ["infrastructure"],
}
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
    const importerLayer = featureLayer(importer)
    const isClientEntry = /(?:^|\/)src\/features\/[^/]+\/client\.[cm]?[jt]sx?$/.test(importer)
    for (const dependency of moduleDependencies(module)) {
      const imported = dependency.specifier
      const targetFeature = imported.match(/^@\/features\/([^/]+)(?:\/(.+))?$/)
      const targetLayer = importedFeatureLayer(imported)

      if (
        isClientEntry &&
        !dependency.typeOnly &&
        (/^(?:node:|better-sqlite3$|@playwright|playwright(?:\/|$))/.test(imported) ||
          /^@\/features\/[^/]+\/(?:infrastructure|server)(?:\/|$)/.test(imported))
      ) {
        violations.push({
          importer,
          imported,
          reason: "Client entry points cannot expose server or infrastructure modules.",
        })
      }

      if (
        importerFeature &&
        targetFeature?.[1] !== importerFeature &&
        targetFeature?.[2] &&
        targetFeature[2] !== "client"
      ) {
        violations.push({
          importer,
          imported,
          reason: "Cross-feature imports must use the owning feature's public interface.",
        })
      }

      if (!/(?:^|\/)src\/worker\//.test(importer) && targetFeature?.[2] === "worker") {
        violations.push({
          importer,
          imported,
          reason: "Worker entry points are reserved for the worker composition root.",
        })
      }

      if (
        !isTest &&
        importerFeature &&
        targetFeature?.[1] === importerFeature &&
        importerLayer &&
        targetLayer &&
        forbiddenLayerDependencies[importerLayer]?.includes(targetLayer)
      ) {
        violations.push({
          importer,
          imported,
          reason: `${importerLayer} modules cannot depend on the ${targetLayer} layer.`,
        })
      }

      if (
        !isTest &&
        importer.includes("/domain/") &&
        (/^(next|react)(\/|$)/.test(imported) ||
          isRuntimeAdapterImport(imported) ||
          (targetFeature?.[1] !== importerFeature &&
            /^@\/features\/[^/]+\/(application|infrastructure|server|presentation)(\/|$)/.test(
              imported,
            )))
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
          (targetFeature?.[1] !== importerFeature &&
            /^@\/features\/[^/]+\/(infrastructure|server|presentation)(\/|$)/.test(imported)))
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
      console.error(`${violation.importer}: ${violation.imported}: ${violation.reason}`)
    }
    process.exitCode = 1
  }
}
