'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DeleteWorkspaceDialog } from '@/components/workspaces/DeleteWorkspaceDialog'

export function DangerZone({
  canDelete,
  workspaceId,
  workspaceName,
}: {
  canDelete: boolean
  workspaceId: string
  workspaceName: string
}) {
  const [open, setOpen] = useState(false)

  if (!canDelete) {
    return null
  }

  return (
    <Card className="space-y-3 border-red-500/40 bg-red-500/5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-red-200">Danger Zone</h2>
          <p className="text-xs text-red-100/80">
            Deleting a workspace will remove all automations and data. This
            action cannot be undone.
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Delete Workspace
        </Button>
      </div>

      <DeleteWorkspaceDialog
        open={open}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onOpenChange={setOpen}
      />
    </Card>
  )
}
