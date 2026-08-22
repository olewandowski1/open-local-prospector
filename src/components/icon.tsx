import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ComponentProps } from "react"

export type IconSvg = IconSvgElement

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon"> &
  Readonly<{
    icon: IconSvg
  }>

// One stroke weight for the whole set; hidden from assistive technology unless given a label.
export function Icon({ strokeWidth = 2, ...props }: IconProps) {
  const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined

  return (
    <HugeiconsIcon
      strokeWidth={strokeWidth}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      {...props}
    />
  )
}
