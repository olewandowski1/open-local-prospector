import { Context, Data, Effect, type Option } from "effect"

import type { RuntimeId } from "@/features/runtime-settings/application/runtime-readiness"

export class RuntimePreferenceError extends Data.TaggedError("RuntimePreferenceError")<{
  readonly operation: "read" | "write"
}> {}

export interface RuntimePreferenceRepositoryService {
  readonly getSelected: Effect.Effect<Option.Option<RuntimeId>, RuntimePreferenceError>
  readonly setSelected: (runtimeId: RuntimeId) => Effect.Effect<void, RuntimePreferenceError>
}

export class RuntimePreferenceRepository extends Context.Tag(
  "RuntimeSettings/RuntimePreferenceRepository",
)<RuntimePreferenceRepository, RuntimePreferenceRepositoryService>() {}

export const getSelectedRuntime = Effect.flatMap(
  RuntimePreferenceRepository,
  (repository) => repository.getSelected,
)

export const setSelectedRuntime = (runtimeId: RuntimeId) =>
  Effect.flatMap(RuntimePreferenceRepository, (repository) => repository.setSelected(runtimeId))
