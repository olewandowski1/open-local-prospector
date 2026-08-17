import { AppShell } from "@/components/app-shell/app-shell"
import { SettingsShell } from "@/components/settings/settings-shell"

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <AppShell>
      <SettingsShell>{children}</SettingsShell>
    </AppShell>
  )
}
