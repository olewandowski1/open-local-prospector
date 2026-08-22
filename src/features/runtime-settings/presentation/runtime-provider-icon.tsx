import { ClaudeIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Openai } from "@/components/ui/svgs/openai"
import type { RuntimeId } from "@/features/runtime-settings/application/runtime-readiness"

export function RuntimeProviderIcon({ runtimeId }: { runtimeId: RuntimeId }) {
  if (runtimeId === "codex") return <Openai aria-hidden="true" className="size-5 fill-current" />
  return <HugeiconsIcon icon={ClaudeIcon} aria-hidden="true" className="size-5" />
}
