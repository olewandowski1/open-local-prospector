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
  // Protect workspace requests while allowing framework-owned static assets.
  matcher: "/((?!_next/static|_next/image).*)",
}
