import { connection } from "next/server"

import {
  DataStoragePage,
  getSuppressions,
  getWorkspaceInventory,
  presentWorkspaceInventory,
} from "@/features/workspace-administration"

export default async function DataSettingsRoute() {
  await connection()
  const inventory = getWorkspaceInventory()
  return (
    <DataStoragePage
      inventory={presentWorkspaceInventory(inventory)}
      suppressions={getSuppressions()}
    />
  )
}
