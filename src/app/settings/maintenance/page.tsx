import { connection } from "next/server"

import { getWorkspaceInventory, WorkspaceActions } from "@/features/workspace-administration"

export default async function MaintenanceSettingsRoute() {
  await connection()

  return (
    <div className="@container mx-auto w-full max-w-5xl">
      <WorkspaceActions inventory={getWorkspaceInventory()} />
    </div>
  )
}
