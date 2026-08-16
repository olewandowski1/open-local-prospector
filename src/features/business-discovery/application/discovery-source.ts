import { Data, type Effect } from "effect"

import type {
  DiscoveryPage,
  DiscoverySearchRequest,
} from "@/features/business-discovery/domain/discovered-business"

export class DiscoverySourceError extends Data.TaggedError("DiscoverySourceError")<{
  readonly classification: "Transient" | "Permanent" | "Blocked" | "Infrastructure"
  readonly code: string
  readonly message: string
}> {}

export interface DiscoverySource {
  readonly identifier: string
  readonly search: (
    request: DiscoverySearchRequest,
  ) => Effect.Effect<DiscoveryPage, DiscoverySourceError>
}
