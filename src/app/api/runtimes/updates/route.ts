import { NextResponse } from "next/server"

import { checkRuntimeUpdates } from "@/features/runtime-settings/server/runtime-update-service"

// Reports versions. Nothing is installed by this route.
export async function GET() {
  const runtimes = await checkRuntimeUpdates()
  return NextResponse.json({ runtimes })
}
