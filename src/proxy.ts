import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { isLoopbackApiRequest } from "@/features/workspace-administration"

export function proxy(request: NextRequest) {
  if (!isLoopbackApiRequest(request)) {
    return NextResponse.json({ error: "Local API request refused." }, { status: 403 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: "/api/:path*",
}
