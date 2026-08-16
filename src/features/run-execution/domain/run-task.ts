export type RunTaskStatus =
  | "Pending"
  | "Leased"
  | "Completed"
  | "FailedPermanent"
  | "Blocked"
  | "Cancelled"

export type RunTask = Readonly<{
  id: string
  runId: string
  businessId?: string
  stage: string
  status: RunTaskStatus
  attemptCount: number
  maxAttempts: number
  leaseOwner?: string
  leaseExpiresAt?: Date
  input: Readonly<Record<string, unknown>>
  checkpoint?: Readonly<Record<string, unknown>>
  schemaVersion: number
  version: number
}>

export type NewRunTask = Readonly<{
  stage: string
  businessId?: string
  input?: Readonly<Record<string, unknown>>
  schemaVersion?: number
}>

export type TaskCheckpoint = Readonly<{
  value: Readonly<Record<string, unknown>>
  nextTasks?: readonly NewRunTask[]
}>

export type TaskFailureClassification =
  | "Transient"
  | "Permanent"
  | "Blocked"
  | "Cancelled"
  | "Infrastructure"

export type StructuredTaskFailure = Readonly<{
  classification: TaskFailureClassification
  code: string
  message: string
  occurredAt: string
}>
