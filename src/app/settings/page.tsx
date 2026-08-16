import { connection } from "next/server"

import { AppShell } from "@/components/app-shell/app-shell"
import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { SettingsPage } from "@/features/local-application/presentation/settings-page"
import { getLocalReadiness } from "@/features/local-application/readiness/get-local-readiness"

export default async function SettingsRoute() {
  await connection()
  const readiness = await getLocalReadiness(loadLocalApplicationConfig())

  return (
    <AppShell>
      <SettingsPage readiness={readiness} />
    </AppShell>
  )
}
