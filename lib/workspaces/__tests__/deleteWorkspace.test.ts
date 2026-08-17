import { describe, expect, it, vi } from 'vitest'

import { deleteWorkspaceCascade } from '@/lib/workspaces/deleteWorkspace'

function delegate() {
  return { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
}

describe('deleteWorkspaceCascade', () => {
  it('deletes AI and dependent workspace records before deleting the workspace', async () => {
    const tx: Record<string, any> = {
      workspaceAIActivity: delegate(),
      workspaceAIProfile: delegate(),
      aiActionAudit: delegate(),
      workspaceSettings: delegate(),
      workspaceDefaults: delegate(),
      workspaceIntegrationConnection: delegate(),
      schedulingNotificationDelivery: delegate(),
      schedulingNotification: delegate(),
      schedulingReminderSchedule: delegate(),
      schedulingEventActivity: delegate(),
      domainOutboxEvent: delegate(),
      calendarSyncConflict: delegate(),
      calendarEventMapping: delegate(),
      calendarSyncCursor: delegate(),
      calendarSyncLog: delegate(),
      calendarWatchChannel: delegate(),
      calendarSyncDiagnostic: delegate(),
      connectedCalendar: delegate(),
      calendarConnection: delegate(),
      schedulingAssignment: delegate(),
      schedulingAttendee: delegate(),
      schedulingAvailabilityRecord: delegate(),
      schedulingRecurrenceMutation: delegate(),
      schedulingEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      schedulingRecurrenceSeries: delegate(),
      automationRunEvent: delegate(),
      automationRun: delegate(),
      automation: delegate(),
      integrationCredential: delegate(),
      integration: delegate(),
      workspaceTeamMember: delegate(),
      workspaceTeam: delegate(),
      workspaceLocation: delegate(),
      workspaceMember: delegate(),
      workspace: { delete: vi.fn().mockResolvedValue({ id: 'ws_1' }) },
    }

    await deleteWorkspaceCascade(tx, 'ws_1')

    expect(tx.workspaceAIActivity.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.workspaceSettings.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.aiActionAudit.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.integrationCredential.deleteMany).toHaveBeenCalledWith({
      where: { integration: { is: { workspaceId: 'ws_1' } } },
    })
    expect(tx.workspaceIntegrationConnection.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.schedulingEvent.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
      data: { recurrenceSeriesId: null },
    })
    expect(tx.calendarConnection.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.workspaceTeamMember.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.workspace.delete).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
    })
  })
})
