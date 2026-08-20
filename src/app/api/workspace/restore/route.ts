import { createWriteStream, mkdtempSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

import {
  assertSameOrigin,
  restoreWorkspace,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export const runtime = "nodejs"

const MAX_BACKUP_BYTES = 5 * 1024 ** 3

export async function POST(request: Request) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "prospector-upload-"))
  const uploadedPath = join(temporaryDirectory, "workspace.olp-backup.tgz")
  try {
    assertSameOrigin(request)
    if (request.headers.get("x-workspace-confirmation") !== "RESTORE") {
      throw new Error("Type RESTORE to confirm replacing the workspace.")
    }
    if (!request.body) throw new Error("Choose a workspace backup to restore.")
    const declaredSize = Number(request.headers.get("content-length") ?? 0)
    if (declaredSize > MAX_BACKUP_BYTES) throw new Error("The backup is larger than 5 GB.")

    let received = 0
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        callback(
          received > MAX_BACKUP_BYTES ? new Error("The backup is larger than 5 GB.") : null,
          chunk,
        )
      },
    })
    await pipeline(
      Readable.fromWeb(request.body as import("node:stream/web").ReadableStream),
      limit,
      createWriteStream(uploadedPath, { flags: "wx" }),
    )
    if (statSync(uploadedPath).size === 0) throw new Error("The selected backup is empty.")
    return Response.json(await restoreWorkspace(uploadedPath))
  } catch (error) {
    return workspaceErrorResponse(error)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}
