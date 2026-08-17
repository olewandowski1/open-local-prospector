import { cookies } from "next/headers"

import {
  parseThemePreference,
  THEME_COOKIE,
} from "@/features/local-application/application/theme-preference"
import { AppearanceSection } from "@/features/local-application/presentation/appearance-section"

export default async function AppearanceSettingsRoute() {
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">Appearance</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          How the workspace looks on this device.
        </p>
      </div>
      <AppearanceSection theme={theme} />
    </div>
  )
}
