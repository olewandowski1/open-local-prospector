import { AppShell } from "@/components/app-shell/app-shell"
import { RunDetailPage } from "@/features/run-monitoring/presentation/run-detail-page"
import { getPersistedRun } from "@/features/run-monitoring/server/run-services"

export default async function RunRoute({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  // The run is a local SQLite read of a few milliseconds, so the server hands the first snapshot
  // over rather than letting every visit render a spinner and wait a round trip for it. A head
  // start, not a requirement: if the read fails, the page fetches for itself as it always did, and
  // polling takes over either way.
  const initialRun = await getPersistedRun(runId).catch(() => undefined)
  return (
    <AppShell>
      <RunDetailPage runId={runId} initialRun={initialRun} />
    </AppShell>
  )
}
