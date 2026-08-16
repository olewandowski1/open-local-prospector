import { Effect } from "effect"
import { NextResponse } from "next/server"

import { validateSearchBrief } from "@/features/prospecting-runs/server/validate-search-brief"

export async function POST(request: Request) {
  let input: unknown

  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const result = await Effect.runPromise(validateSearchBrief(input))
  return NextResponse.json(result, { status: result.valid ? 200 : 400 })
}
