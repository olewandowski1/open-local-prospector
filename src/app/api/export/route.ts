import { NextResponse } from "next/server"
import { loadLocalApplicationConfig } from "@/features/local-application"
import { exportCandidates } from "@/features/review-queue/infrastructure/export-candidates"

export function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const format = url.searchParams.get("format") === "json" ? "json" : "csv"
    const statuses = url.searchParams.getAll("status")
    const result = exportCandidates(loadLocalApplicationConfig().databasePath, {
      format,
      statuses: statuses.length > 0 ? statuses : undefined,
      includeNamedProfessionalContacts:
        url.searchParams.get("includeNamedProfessionalContacts") === "true",
    })
    return new NextResponse(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Export failed safely." }, { status: 500 })
  }
}
