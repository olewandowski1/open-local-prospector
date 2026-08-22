"use client"

import { BracesIcon, DownloadIcon, FileSpreadsheetIcon } from "@hugeicons/core-free-icons"
import { useState } from "react"
import { Icon, type IconSvg } from "@/components/icon"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

type ExportFormat = "csv" | "json"

const formats: readonly Readonly<{
  value: ExportFormat
  label: string
  detail: string
  icon: IconSvg
}>[] = [
  {
    value: "csv",
    label: "CSV",
    detail: "One row per candidate, for a spreadsheet.",
    icon: FileSpreadsheetIcon,
  },
  {
    value: "json",
    label: "JSON",
    detail: "Full records, for another tool to read.",
    icon: BracesIcon,
  },
]

export function ExportDialog({
  statusFilter,
  count,
  exportQuery,
}: {
  statusFilter: string
  count: number
  exportQuery: string
}) {
  const [format, setFormat] = useState<ExportFormat>("csv")

  const scope =
    statusFilter === "All"
      ? `Every candidate in the queue (${count}).`
      : `Candidates with the status ${statusFilter} (${count}).`

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" className="h-8">
            <Icon icon={DownloadIcon} data-icon="inline-start" />
            Export
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Candidates</DialogTitle>
          <DialogDescription>{scope} Suppressed businesses are never included.</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={format}
          onValueChange={(value) => setFormat(value === "json" ? "json" : "csv")}
          aria-label="Export Format"
          className="grid gap-2"
        >
          {formats.map((option) => {
            const selected = option.value === format
            return (
              // The whole card is the label, so anywhere on it selects the format.
              <FieldLabel
                key={option.value}
                htmlFor={`export-${option.value}`}
                className={cn(
                  "w-full cursor-pointer rounded-lg border p-3 transition-colors",
                  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  selected ? "border-foreground/30 bg-muted" : "hover:bg-muted/50",
                )}
              >
                <div className="flex w-full items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon icon={option.icon} className="size-3.5 text-muted-foreground" />
                      {option.label}
                    </p>
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                      {option.detail}
                    </p>
                  </div>
                  <RadioGroupItem value={option.value} id={`export-${option.value}`} />
                </div>
              </FieldLabel>
            )
          })}
        </RadioGroup>

        <DialogFooter layout="stretch">
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          {/* A plain anchor, so the browser performs the download rather than the application. */}
          <DialogClose
            nativeButton={false}
            render={
              <a
                className={buttonVariants()}
                href={`/api/export?format=${format}${exportQuery}`}
                download
              >
                Download {format.toUpperCase()}
              </a>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
