import { AppShell } from "@/components/app-shell/app-shell"
import { RunDetailPage } from "@/features/run-monitoring/presentation/run-detail-page"

export default async function RunRoute({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  return (
    <AppShell>
      <RunDetailPage runId={runId} />
    </AppShell>
  )
}
