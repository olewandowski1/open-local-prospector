# Organize source by feature and colocate unit tests

Application source will be organized around product features such as Prospecting Runs and the Prospecting Overview. A feature owns its domain rules, application execution, infrastructure adapters, server integration, and presentation where those concerns exist. Internal folders are introduced only when they hide real complexity; tiny features remain flat rather than copying a complete folder template.

Unit tests live beside the file they exercise using the `*.test.ts` or `*.test.tsx` suffix. This keeps behavior and its test surface local, makes feature deletion complete, and prevents a parallel test tree from drifting away from source structure. Cross-feature browser flows remain in `tests/e2e` because they verify the assembled Local Application rather than one source module.

Shared code is limited to genuinely cross-feature application shell, shadcn primitives, and utilities. Features do not import another feature's infrastructure or presentation internals. When collaboration is required, they use the owning feature's narrow public interface. This decision complements ADR 0010: Effect remains inside server and worker execution, while feature ownership determines source locality.
