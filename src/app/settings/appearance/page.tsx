import { cookies } from "next/headers"

import {
  parseThemePreference,
  THEME_COOKIE,
} from "@/features/local-application/application/theme-preference"
import { AppearanceSection } from "@/features/local-application/presentation/appearance-section"

export default async function AppearanceSettingsRoute() {
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-8">
      <section aria-labelledby="appearance-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="appearance-heading" className="font-heading text-lg font-semibold">
            Appearance
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How the workspace looks on this device.
          </p>
        </div>
        <AppearanceSection theme={theme} />
      </section>
    </div>
  )
}
