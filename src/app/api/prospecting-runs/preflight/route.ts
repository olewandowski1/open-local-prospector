import { NextResponse } from "next/server"

import { runSearchBriefPreflight } from "@/features/prospecting-runs/server/search-brief-services"
import { assertSameOrigin } from "@/features/workspace-administration"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const result = await runSearchBriefPreflight(await request.json())
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "The Search Brief could not be interpreted. Check each field and try again." },
      { status: 400 },
    )
  }
}
