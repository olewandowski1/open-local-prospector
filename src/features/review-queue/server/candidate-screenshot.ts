import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

import Database from "better-sqlite3"

const MAX_SCREENSHOT_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

type ScreenshotRow = Readonly<{ path: string; mime_type: string; byte_size: number }>

export async function readCandidateScreenshot(
  databasePath: string,
  artifactsPath: string,
  scoreId: string,
  artifactId: string,
): Promise<Readonly<{ body: Uint8Array; mimeType: string }> | undefined> {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  let row: ScreenshotRow | undefined
  try {
    row = database
      .prepare(
        `select ia.path,ia.mime_type,ia.byte_size
         from candidate_scores cs
         join website_assessments wa on wa.id=cs.assessment_id
         join inspection_artifacts ia on ia.inspection_id=wa.inspection_id
         where cs.id=? and ia.id=? and ia.kind='Screenshot'`,
      )
      .get(scoreId, artifactId) as ScreenshotRow | undefined
  } finally {
    database.close()
  }
  if (
    !row ||
    !ALLOWED_MIME_TYPES.has(row.mime_type) ||
    row.byte_size < 0 ||
    row.byte_size > MAX_SCREENSHOT_BYTES
  )
    return undefined

  const root = await realpath(resolve(artifactsPath))
  const file = await realpath(resolve(row.path))
  const relation = relative(root, file)
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) return undefined
  const fileState = await stat(file)
  if (
    !fileState.isFile() ||
    fileState.size > MAX_SCREENSHOT_BYTES ||
    fileState.size !== row.byte_size
  )
    return undefined
  return { body: await readFile(file), mimeType: row.mime_type }
}
