import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ComponentProps } from "react"

/**
 * One icon from `@hugeicons/core-free-icons`. Threading this type is what lets a navigation entry or
 * a status descriptor carry its icon as data instead of as markup.
 */
export type IconSvg = IconSvgElement

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon"> &
  Readonly<{
    icon: IconSvg
  }>

/**
 * The workspace's only icon. Hugeicons bakes a different stroke weight into each icon unless one is
 * given, so a shared weight here is what keeps a row of icons looking like one set rather than a
 * collection.
 *
 * Icons in this application nearly always sit beside a label, or inside an `IconButton` that names
 * the action, so they are hidden from assistive technology by default. Give one an `aria-label` and
 * it announces itself instead — that is the only case where an icon carries meaning alone.
 *
 * The generated primitives in `src/components/ui/` call `HugeiconsIcon` directly, because that is
 * what `shadcn add` writes and re-writes. Everything else goes through here.
 */
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
