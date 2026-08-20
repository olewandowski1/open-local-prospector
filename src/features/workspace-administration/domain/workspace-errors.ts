export class WorkspaceBusyError extends Error {
  constructor(
    readonly runId: string,
    readonly runLabel: string,
  ) {
    super(`Run ${runLabel} is still active.`)
  }
}

export class BackupValidationError extends Error {}
