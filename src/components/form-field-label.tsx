"use client"

import { InfoButton } from "@/components/info-button"
import { FieldLabel } from "@/components/ui/field"

export function FormFieldLabel({
  htmlFor,
  label,
  description,
}: {
  htmlFor: string
  label: string
  description: string
}) {
  return (
    <div className="flex items-center gap-1">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      <InfoButton description={description} />
    </div>
  )
}
