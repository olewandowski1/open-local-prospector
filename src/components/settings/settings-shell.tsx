"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Icon } from "@/components/icon"

import { PageHeader } from "@/components/page-layout"
import { PageScroller } from "@/components/page-scroller"
import { settingsSections } from "@/components/settings/settings-navigation"
import { cn } from "@/lib/utils"

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <PageScroller className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Everything here applies to this device only. The application stores no account and no provider credentials."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <nav aria-label="Settings sections" className="lg:w-52 lg:shrink-0">
          <ul className="grid grid-cols-2 gap-1 sm:flex lg:flex-col">
            {settingsSections.map((section) => {
              const active = pathname === section.href
              return (
                <li key={section.href} className="min-w-0 sm:shrink-0 lg:w-full">
                  <Link
                    href={section.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon icon={section.icon} className="size-4 shrink-0" />
                    {section.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageScroller>
  )
}
