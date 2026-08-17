"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { settingsSections } from "@/components/settings/settings-navigation"
import { cn } from "@/lib/utils"

/**
 * Two-pane settings layout: a persistent section list beside the active section. The list is a
 * horizontal strip on small screens so it never eats the reading width.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Everything here applies to this device only. The application stores no account and no
          provider credentials.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
        <nav aria-label="Settings sections" className="lg:w-52 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {settingsSections.map((section) => {
              const active = pathname === section.href
              return (
                <li key={section.href} className="shrink-0 lg:w-full">
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

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  )
}
