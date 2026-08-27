import { connection } from "next/server"

import { AppShell } from "@/components/app-shell/app-shell"
import { RunsPage } from "@/features/run-monitoring/presentation/runs-page"
import { listPersistedRuns } from "@/features/run-monitoring/server/run-services"

export default async function RunsRoute() {
  await connection()
  const runList = await listPersistedRuns()

  return (
    <AppShell>
      <RunsPage runList={runList} now={new Date()} />
    </AppShell>
  )
}
