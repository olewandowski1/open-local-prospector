export type WorkspaceInventory = Readonly<{
  databasePath: string
  databaseBytes: number
  artifactsPath: string
  artifactCount: number
  artifactBytes: number
  runs: number
  discoveredBusinesses: number
  qualifiedCandidates: number
  decisionsRecorded: number
  technicalEvents: number
  suppressions: number
}>

export type WorkspaceInventoryPresentation = Readonly<{
  databasePath: string
  databaseSize: string
  artifactsPath: string
  artifactCount: string
  artifactSize: string
  runs: string
  discoveredBusinesses: string
  qualifiedCandidates: string
  decisionsRecorded: string
  technicalEvents: string
  suppressions: string
}>

const numberFormat = new Intl.NumberFormat("en-US")
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

export function formatCount(value: number): string {
  return numberFormat.format(value)
}

export function formatWorkspaceDate(value: string): string {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? "Unknown" : dateFormat.format(new Date(timestamp))
}

export function presentWorkspaceInventory(
  inventory: WorkspaceInventory,
): WorkspaceInventoryPresentation {
  return {
    databasePath: inventory.databasePath,
    databaseSize: formatBytes(inventory.databaseBytes),
    artifactsPath: inventory.artifactsPath,
    artifactCount: formatCount(inventory.artifactCount),
    artifactSize: formatBytes(inventory.artifactBytes),
    runs: formatCount(inventory.runs),
    discoveredBusinesses: formatCount(inventory.discoveredBusinesses),
    qualifiedCandidates: formatCount(inventory.qualifiedCandidates),
    decisionsRecorded: formatCount(inventory.decisionsRecorded),
    technicalEvents: formatCount(inventory.technicalEvents),
    suppressions: formatCount(inventory.suppressions),
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"] as const
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unit
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}
