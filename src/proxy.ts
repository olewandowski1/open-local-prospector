import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { isLoopbackRequest } from "@/features/workspace-administration"

export function proxy(request: NextRequest) {
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ error: "Local application request refused." }, { status: 403 })
  }
  return NextResponse.next()
}

export const config = {
  // Protect dynamic pages, route handlers, RSC requests, and Server Actions. Framework-owned static
  // image assets carry no workspace data and do not need the request admission check.
  matcher: "/((?!_next/static|_next/image).*)",
}
