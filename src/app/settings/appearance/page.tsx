import { cookies } from "next/headers"

import { SectionHeader } from "@/components/page-layout"
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
        <SectionHeader
          title={<span id="appearance-heading">Appearance</span>}
          description="How the workspace looks on this device."
        />
        <AppearanceSection theme={theme} />
      </section>
    </div>
  )
}
