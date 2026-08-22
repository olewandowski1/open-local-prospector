"use client"

import { Add01Icon, LayoutGridIcon, ListViewIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon, type IconSvg } from "@/components/icon"

import { buttonVariants } from "@/components/ui/button"
import { RunCard } from "@/features/run-monitoring/presentation/run-card"
import type { RunRow } from "@/features/run-monitoring/presentation/run-presentation"
import { RunsTable } from "@/features/run-monitoring/presentation/runs-table"
import { cn } from "@/lib/utils"

type RunsView = "table" | "cards"

const VIEW_STORAGE_KEY = "v1:runs-view"

const views: readonly Readonly<{ value: RunsView; label: string; icon: IconSvg }>[] = [
  { value: "table", label: "Table", icon: ListViewIcon },
  { value: "cards", label: "Cards", icon: LayoutGridIcon },
]

export function RunsWorkspace({ runs }: { runs: readonly RunRow[] }) {
  const [view, setView] = useState<RunsView>("table")

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === "table" || stored === "cards") setView(stored)
  }, [])

  const select = (next: RunsView) => {
    setView(next)
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <fieldset className="flex items-center gap-0.5 rounded-lg border p-0.5">
          <legend className="sr-only">Runs View</legend>
          {views.map((option) => (
            <label
              key={option.value}
              title={option.label}
              className={cn(
                "relative flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                view === option.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Covers the label so the native control stays the click and focus target. */}
              <input
                type="radio"
                name="runs-view"
                value={option.value}
                checked={view === option.value}
                onChange={() => select(option.value)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <Icon icon={option.icon} className="size-4" />
              {/* The icons are the whole control, so the name lives here for assistive technology. */}
              <span className="sr-only">{option.label}</span>
            </label>
          ))}
        </fieldset>

        <Link href="/runs/new" className={cn(buttonVariants({ size: "sm" }), "h-8")}>
          <Icon icon={Add01Icon} data-icon="inline-start" />
          New Run
        </Link>
      </div>

      {view === "table" ? (
        <RunsTable runs={runs} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  )
}
