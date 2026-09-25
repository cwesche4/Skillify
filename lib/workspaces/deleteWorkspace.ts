import { Prisma } from '@prisma/client'

type PrismaTransaction = Record<string, any>

async function deleteMany(
  tx: PrismaTransaction,
  delegate: string,
  where: Record<string, unknown>,
) {
  if (tx[delegate]?.deleteMany) {
    await tx[delegate].deleteMany({ where })
  }
}

async function updateMany(
  tx: PrismaTransaction,
  delegate: string,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  if (tx[delegate]?.updateMany) {
    await tx[delegate].updateMany({ where, data })
  }
}

export async function deleteWorkspaceCascade(
  tx: PrismaTransaction,
  workspaceId: string,
) {
  // Serialize workspace deletion with transactions that perform a final
  // workspace-scoped delivery check before inserting durable notifications.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`,
  )

  await deleteMany(tx, 'inspectorPresetShare', {
    OR: [
      { sourceWorkspaceId: workspaceId },
      { targetWorkspaceId: workspaceId },
    ],
  })
  await deleteMany(tx, 'inspectorPresetVersion', {
    preset: { is: { workspaceId } },
  })
  await deleteMany(tx, 'inspectorPreset', { workspaceId })

  await deleteMany(tx, 'automationVersionSnapshot', {
    version: { is: { workspaceId } },
  })
  await deleteMany(tx, 'automationVersion', { workspaceId })
  await deleteMany(tx, 'nodeLock', { workspaceId })
  await deleteMany(tx, 'presenceState', { workspaceId })
  await deleteMany(tx, 'collaborationSession', { workspaceId })

  await deleteMany(tx, 'workspaceAIActivity', { workspaceId })
  await deleteMany(tx, 'workspaceAIProfile', { workspaceId })
  await deleteMany(tx, 'aiActionAudit', { workspaceId })
  await deleteMany(tx, 'workspaceSettings', { workspaceId })
  await deleteMany(tx, 'workspaceDefaults', { workspaceId })

  await deleteMany(tx, 'secretVersion', { workspaceId })
  await deleteMany(tx, 'workspaceSecret', { workspaceId })

  await deleteMany(tx, 'contractEntitlement', { workspaceId })
  await deleteMany(tx, 'contractException', { workspaceId })
  await deleteMany(tx, 'entitlementAuditEvent', { workspaceId })
  await deleteMany(tx, 'auditEvent', { workspaceId })
  await deleteMany(tx, 'workspacePattern', { workspaceId })
  await deleteMany(tx, 'automationLineage', { workspaceId })

  await deleteMany(tx, 'automationRunEvent', {
    run: { is: { workspaceId } },
  })
  await deleteMany(tx, 'automationRun', { workspaceId })

  // Simple Automation rows use RESTRICT workspace/automation foreign keys.
  // Remove the idempotency ledger and installation ownership rows before the
  // linked managed Automations and workspace are deleted.
  await deleteMany(tx, 'simpleAutomationDispatch', { workspaceId })
  await deleteMany(tx, 'simpleAutomationInstallation', { workspaceId })

  await deleteMany(tx, 'upsellRequest', { workspaceId })
  await deleteMany(tx, 'enterpriseConsultRequest', { workspaceId })
  await deleteMany(tx, 'templatePurchase', { workspaceId })
  await deleteMany(tx, 'microUpsellPurchase', { workspaceId })
  await deleteMany(tx, 'automation', { workspaceId })
  await deleteMany(tx, 'automationTemplate', { workspaceId })

  await deleteMany(tx, 'integrationCredential', {
    integration: { is: { workspaceId } },
  })
  await deleteMany(tx, 'workspaceIntegrationConnection', { workspaceId })
  await deleteMany(tx, 'externalRecord', { workspaceId })
  await deleteMany(tx, 'integration', { workspaceId })

  await deleteMany(tx, 'schedulingNotificationDelivery', { workspaceId })
  await deleteMany(tx, 'schedulingNotification', { workspaceId })
  await deleteMany(tx, 'schedulingReminderSchedule', { workspaceId })
  await deleteMany(tx, 'schedulingEventActivity', { workspaceId })
  await deleteMany(tx, 'domainOutboxEvent', { workspaceId })

  await deleteMany(tx, 'calendarSyncConflict', { workspaceId })
  await deleteMany(tx, 'calendarEventMapping', { workspaceId })
  await deleteMany(tx, 'calendarSyncCursor', { workspaceId })
  await deleteMany(tx, 'calendarSyncLog', { workspaceId })
  await deleteMany(tx, 'calendarWatchChannel', { workspaceId })
  await deleteMany(tx, 'calendarSyncDiagnostic', { workspaceId })
  await deleteMany(tx, 'connectedCalendar', { workspaceId })
  await deleteMany(tx, 'calendarConnection', { workspaceId })

  await deleteMany(tx, 'schedulingAssignment', { workspaceId })
  await deleteMany(tx, 'schedulingAttendee', { workspaceId })
  await deleteMany(tx, 'schedulingAvailabilityRecord', { workspaceId })
  await deleteMany(tx, 'schedulingRecurrenceMutation', { workspaceId })
  await updateMany(
    tx,
    'schedulingEvent',
    { workspaceId },
    { recurrenceSeriesId: null },
  )
  await deleteMany(tx, 'schedulingRecurrenceSeries', { workspaceId })
  await deleteMany(tx, 'schedulingEvent', { workspaceId })

  await deleteMany(tx, 'rescheduleToken', {
    booking: { is: { workspaceId } },
  })
  await deleteMany(tx, 'externalCalendarEvent', { workspaceId })
  await deleteMany(tx, 'reminderSequence', { workspaceId })
  await deleteMany(tx, 'availabilityWindow', { workspaceId })
  await deleteMany(tx, 'booking', { workspaceId })
  await deleteMany(tx, 'bookingType', { workspaceId })
  await deleteMany(tx, 'calendarAccount', { workspaceId })

  await deleteMany(tx, 'dashboardPreference', { workspaceId })
  await deleteMany(tx, 'auditLog', { workspaceId })
  await deleteMany(tx, 'workspaceInvite', { workspaceId })

  // Durable operational history uses restrictive workspace/member foreign
  // keys, so children must be removed explicitly during workspace deletion.
  await deleteMany(tx, 'workItem', { workspaceId })
  await deleteMany(tx, 'job', { workspaceId })

  // Leads may reference their converted Customer with a restrictive FK.
  // Delete Leads before Customers, then remove both before assigned members.
  await deleteMany(tx, 'lead', { workspaceId })
  await deleteMany(tx, 'customer', { workspaceId })

  await deleteMany(tx, 'workspaceTeamMember', { workspaceId })
  await deleteMany(tx, 'workspaceTeam', { workspaceId })
  await deleteMany(tx, 'workspaceLocation', { workspaceId })
  await deleteMany(tx, 'workspaceMember', { workspaceId })

  await tx.workspace.delete({ where: { id: workspaceId } })
}
