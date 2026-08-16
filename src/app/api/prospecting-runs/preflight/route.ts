import { NextResponse } from "next/server"

import { runSearchBriefPreflight } from "@/features/prospecting-runs/server/search-brief-services"

export async function POST(request: Request) {
  try {
    const result = await runSearchBriefPreflight(await request.json())
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "The Search Brief could not be interpreted. Check each field and try again." },
      { status: 400 },
    )
  }
}
