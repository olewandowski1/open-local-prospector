"use client"

import { LayoutGrid, Rows3 } from "lucide-react"
import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { RunCard } from "@/features/run-monitoring/presentation/run-card"
import type { RunRow } from "@/features/run-monitoring/presentation/run-presentation"
import { RunsTable } from "@/features/run-monitoring/presentation/runs-table"
import { cn } from "@/lib/utils"

type RunsView = "table" | "cards"

const VIEW_STORAGE_KEY = "runs-view"

const views: readonly Readonly<{ value: RunsView; label: string; icon: typeof Rows3 }>[] = [
  { value: "table", label: "Table", icon: Rows3 },
  { value: "cards", label: "Cards", icon: LayoutGrid },
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {runs.length} {runs.length === 1 ? "Run" : "Runs"}
        </p>
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
              <option.icon aria-hidden="true" className="size-4" />
              {/* The icons are the whole control, so the name lives here for assistive technology. */}
              <span className="sr-only">{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>

      {view === "table" ? (
        <Card className="overflow-hidden py-0">
          <CardContent className="px-0">
            <RunsTable runs={runs} />
          </CardContent>
        </Card>
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
