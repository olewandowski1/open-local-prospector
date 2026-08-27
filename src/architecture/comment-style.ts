import { readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { parse } from "@babel/parser"

export type CommentStyleViolation = Readonly<{
  file: string
  line: number
  message: string
}>

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"])

export function findCommentStyleViolations(root: string): readonly CommentStyleViolation[] {
  const files = [
    ...collectSourceFiles(join(root, "src")),
    ...collectSourceFiles(join(root, "tests")),
    ...readdirSync(root)
      .map((name) => join(root, name))
      .filter(
        (path) =>
          statSync(path).isFile() &&
          !path.endsWith(".d.ts") &&
          SOURCE_EXTENSIONS.has(extname(path)),
      ),
  ]

  return files.flatMap((file) => inspectFile(root, file))
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(path)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })
}

function inspectFile(root: string, file: string): CommentStyleViolation[] {
  const source = readFileSync(file, "utf8")
  return findSourceCommentStyleViolations(source, relative(root, file), file.endsWith(".tsx"))
}

export function findSourceCommentStyleViolations(
  source: string,
  file: string,
  jsx = false,
): CommentStyleViolation[] {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", ...(jsx ? (["jsx"] as const) : [])],
  })
  const comments = ast.comments ?? []
  const violations: CommentStyleViolation[] = []

  comments.forEach((comment, index) => {
    const start = comment.loc?.start.line
    const end = comment.loc?.end.line
    if (!start || !end) return
    if (start !== end) {
      violations.push({
        file,
        line: start,
        message: "Comment exceeds one line.",
      })
    }
    const previous = comments[index - 1]
    if (
      comment.type === "CommentLine" &&
      previous?.type === "CommentLine" &&
      previous.loc?.end.line === start - 1
    ) {
      violations.push({
        file,
        line: start,
        message: "Adjacent line comments form a multi-line comment.",
      })
    }
  })

  return violations
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = process.cwd()
  const violations = findCommentStyleViolations(root)
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line} ${violation.message}`)
    }
    process.exitCode = 1
  }
}
