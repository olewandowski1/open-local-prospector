"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-layout"
import { settingsSections } from "@/components/settings/settings-navigation"
import { cn } from "@/lib/utils"

/**
 * Two-pane settings layout: a persistent section list beside the active section. The list is a
 * horizontal strip on small screens so it never eats the reading width.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col gap-6 overflow-hidden p-4 sm:p-6">
      <PageHeader
        title="Settings"
        description="Everything here applies to this device only. The application stores no account and no provider credentials."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
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
                    <section.icon aria-hidden="true" className="size-4 shrink-0" />
                    {section.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="app-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </main>
  )
}
