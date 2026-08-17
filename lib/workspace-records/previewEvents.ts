export type WorkspaceCrmRecordScope =
  | 'clients'
  | 'leads'
  | 'tasks'
  | 'serviceRequests'
  | 'opportunities'
  | 'sales'
  | 'salesPipeline'
  | 'activity'

export const workspaceCrmRecordsChangedEvent =
  'skillify:workspace-crm-records-changed'

export type WorkspaceCrmRecordsChangedDetail = {
  workspaceId: string
  scope: WorkspaceCrmRecordScope
}

export function notifyWorkspaceCrmRecordsChanged(
  workspaceId: string,
  scope: WorkspaceCrmRecordScope,
) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<WorkspaceCrmRecordsChangedDetail>(
      workspaceCrmRecordsChangedEvent,
      {
        detail: { workspaceId, scope },
      },
    ),
  )
}

export function isWorkspaceCrmRecordsChangedEvent(
  event: Event,
): event is CustomEvent<WorkspaceCrmRecordsChangedDetail> {
  return event.type === workspaceCrmRecordsChangedEvent
}
