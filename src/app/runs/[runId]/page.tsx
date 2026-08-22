import { AppShell } from "@/components/app-shell/app-shell"
import { RunDetailPage } from "@/features/run-monitoring/presentation/run-detail-page"
import { getPersistedRun } from "@/features/run-monitoring/server/run-services"

export default async function RunRoute({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  // A head start, not a requirement: on failure the page fetches for itself as it always did.
  const initialRun = await getPersistedRun(runId).catch(() => undefined)
  return (
    <AppShell>
      <RunDetailPage runId={runId} initialRun={initialRun} />
    </AppShell>
  )
}
