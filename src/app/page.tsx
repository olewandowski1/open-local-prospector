import { AppShell } from "@/components/app-shell/app-shell"
import { ReviewQueuePage } from "@/features/review-queue"

export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <AppShell>
      <ReviewQueuePage />
    </AppShell>
  )
}
