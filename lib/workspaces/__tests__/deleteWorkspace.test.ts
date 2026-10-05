import { describe, expect, it, vi } from 'vitest'

import { deleteWorkspaceCascade } from '@/lib/workspaces/deleteWorkspace'

function delegate() {
  return { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
}

describe('deleteWorkspaceCascade', () => {
  it('deletes AI and dependent workspace records before deleting the workspace', async () => {
    const tx: Record<string, any> = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'ws_1' }]),
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
      estimateOperationalizationItem: delegate(),
      recurringServiceStepTemplate: delegate(),
      recurringService: delegate(),
      schedulingEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      schedulingRecurrenceSeries: delegate(),
      automationRunEvent: delegate(),
      estimateFollowUpSchedule: delegate(),
      automationRun: delegate(),
      simpleAutomationDispatch: delegate(),
      simpleAutomationInstallation: delegate(),
      automation: delegate(),
      integrationCredential: delegate(),
      integration: delegate(),
      workItem: delegate(),
      jobAssignment: delegate(),
      job: delegate(),
      estimateOperationalization: delegate(),
      estimateDecision: delegate(),
      estimateDelivery: delegate(),
      estimateShare: delegate(),
      estimateLineItem: delegate(),
      estimate: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      customer: delegate(),
      lead: delegate(),
      workspaceTeamMember: delegate(),
      workspaceTeam: delegate(),
      workspaceLocation: delegate(),
      workspaceMember: delegate(),
      workspace: { delete: vi.fn().mockResolvedValue({ id: 'ws_1' }) },
    }

    await deleteWorkspaceCascade(tx, 'ws_1')

    expect(tx.$queryRaw).toHaveBeenCalledOnce()
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.schedulingNotification.deleteMany.mock.invocationCallOrder[0],
    )

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
    expect(tx.recurringServiceStepTemplate.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.recurringService.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(
      tx.recurringServiceStepTemplate.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.recurringService.deleteMany.mock.invocationCallOrder[0])
    expect(
      tx.recurringService.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      tx.schedulingRecurrenceSeries.deleteMany.mock.invocationCallOrder[0],
    )
    expect(tx.calendarConnection.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.simpleAutomationDispatch.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.simpleAutomationInstallation.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(
      tx.simpleAutomationInstallation.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.automation.deleteMany.mock.invocationCallOrder[0])
    expect(tx.workspaceTeamMember.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.workItem.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.jobAssignment.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.job.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.workItem.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.job.deleteMany.mock.invocationCallOrder[0],
    )
    expect(
      tx.jobAssignment.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.job.deleteMany.mock.invocationCallOrder[0])
    expect(tx.job.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.recurringService.deleteMany.mock.invocationCallOrder[0],
    )
    expect(
      tx.estimateOperationalizationItem.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.job.deleteMany.mock.invocationCallOrder[0])
    expect(
      tx.estimateOperationalizationItem.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.recurringService.deleteMany.mock.invocationCallOrder[0])
    expect(tx.job.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.schedulingEvent.deleteMany.mock.invocationCallOrder[0],
    )
    expect(tx.lead.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(tx.estimateFollowUpSchedule.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(
      tx.estimateFollowUpSchedule.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      tx.simpleAutomationInstallation.deleteMany.mock.invocationCallOrder[0],
    )
    expect(
      tx.estimateFollowUpSchedule.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.automationRun.deleteMany.mock.invocationCallOrder[0])
    expect(tx.estimateDecision.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
    })
    expect(
      tx.estimateDelivery.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.estimateShare.deleteMany.mock.invocationCallOrder[0])
    expect(
      tx.estimateDecision.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.estimateShare.deleteMany.mock.invocationCallOrder[0])
    expect(
      tx.estimateLineItem.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.estimate.deleteMany.mock.invocationCallOrder[0])
    expect(tx.estimate.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws_1' },
      data: { previousRevisionId: null },
    })
    expect(tx.estimate.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.lead.deleteMany.mock.invocationCallOrder[0],
    )
    expect(
      tx.domainOutboxEvent.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.lead.deleteMany.mock.invocationCallOrder[0])
    expect(tx.job.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.lead.deleteMany.mock.invocationCallOrder[0],
    )
    expect(tx.lead.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.customer.deleteMany.mock.invocationCallOrder[0],
    )
    expect(tx.customer.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.workspaceMember.deleteMany.mock.invocationCallOrder[0],
    )
    expect(tx.lead.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.workspaceMember.deleteMany.mock.invocationCallOrder[0],
    )
    expect(tx.workspace.delete).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
    })
  })
})
