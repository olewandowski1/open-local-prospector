import { Readable } from "node:stream"
import {
  downloadWorkspaceBackup,
  workspaceErrorResponse,
} from "@/features/workspace-administration/server/workspace-services"

export const runtime = "nodejs"

export async function GET() {
  try {
    const backup = await downloadWorkspaceBackup()
    const stream = backup.createStream()
    stream.once("close", backup.cleanup)
    stream.once("error", backup.cleanup)
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(backup.size),
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return workspaceErrorResponse(error)
  }
}
