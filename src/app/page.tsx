import { AppShell } from "@/components/app-shell/app-shell"
import { OverviewPage } from "@/features/overview/overview-page"

export default function Home() {
  return (
    <AppShell>
      <OverviewPage />
    </AppShell>
  )
}
