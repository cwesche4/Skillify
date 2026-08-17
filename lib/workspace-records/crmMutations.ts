import type { WorkspaceClient } from '@/lib/clients/types'
import type { LeadRecord } from '@/lib/sales/demoSalesRecords'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import type { TaskRecord } from '@/lib/tasks/demoTasks'
import {
  createWorkspaceActivityRecord,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'
import { getLocalTimestamp } from '@/lib/formatting/dates'

type MutationResult<TRecord> = {
  record: TRecord
  events: WorkspaceActivityRecord[]
}

function hasChanged<TRecord, TKey extends keyof TRecord>(
  before: TRecord,
  after: TRecord,
  key: TKey,
) {
  return before[key] !== after[key]
}

export function updateClientRecordWithRules(
  client: WorkspaceClient,
  updates: Partial<WorkspaceClient>,
): MutationResult<WorkspaceClient> {
  const record = {
    ...client,
    ...updates,
    lastActivity: updates.lastActivity ?? getLocalTimestamp(),
  }
  const events: WorkspaceActivityRecord[] = []

  if (hasChanged(client, record, 'ownerId')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'client',
        action: 'ownerChanged',
        title: 'Client owner changed',
        description: `${record.company} ownership was updated.`,
        metadata: {
          previousOwnerId: client.ownerId,
          nextOwnerId: record.ownerId,
        },
      }),
    )
  }

  if (hasChanged(client, record, 'pipelineStage')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'client',
        action: 'statusChanged',
        title: 'Fulfillment stage changed',
        description: `${record.company} moved to ${record.pipelineStage}.`,
        metadata: {
          previousStage: client.pipelineStage,
          nextStage: record.pipelineStage,
        },
      }),
    )
  }

  if (hasChanged(client, record, 'health')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'client',
        action: 'updated',
        title: 'Client health changed',
        description: `${record.company} health is now ${record.health}.`,
        metadata: {
          previousHealth: client.health,
          nextHealth: record.health,
        },
      }),
    )
  }

  if (hasChanged(client, record, 'nextAction')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'client',
        action: 'updated',
        title: 'Client next action changed',
        description: `${record.company} next action is ${record.nextAction}.`,
        metadata: {
          previousNextAction: client.nextAction,
          nextNextAction: record.nextAction,
        },
      }),
    )
  }

  if (
    hasChanged(client, record, 'notes') ||
    client.internalNotes !== record.internalNotes
  ) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'client',
        action: 'noteAdded',
        title: 'Internal Notes updated',
        description: `${record.company} internal notes were updated.`,
      }),
    )
  }

  if (events.length === 0) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'client',
        action: 'updated',
        title: 'Client updated',
        description: `${record.company} was updated.`,
      }),
    )
  }

  return { record, events }
}

export function updateLeadRecordWithRules(
  lead: LeadRecord,
  updates: Partial<LeadRecord>,
): MutationResult<LeadRecord> {
  const record: LeadRecord = {
    ...lead,
    ...updates,
    lastActivityAt: updates.lastActivityAt ?? getLocalTimestamp(),
  }
  const events: WorkspaceActivityRecord[] = []

  if (hasChanged(lead, record, 'ownerId')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: 'preview',
        recordId: record.id,
        recordType: 'lead',
        action: 'ownerChanged',
        title: 'Lead owner changed',
        description: `${record.name} ownership was updated.`,
        metadata: {
          previousOwnerId: lead.ownerId,
          nextOwnerId: record.ownerId,
        },
      }),
    )
  }

  if (hasChanged(lead, record, 'status')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: 'preview',
        recordId: record.id,
        recordType: 'lead',
        action: 'statusChanged',
        title: 'Lead status changed',
        description: `${record.name} is now ${record.status}.`,
        metadata: {
          previousStatus: lead.status,
          nextStatus: record.status,
        },
      }),
    )
  }

  if (hasChanged(lead, record, 'stage')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: 'preview',
        recordId: record.id,
        recordType: 'lead',
        action: 'statusChanged',
        title: 'Lead stage changed',
        description: `Lead stage changed from ${lead.stage} to ${record.stage}.`,
        metadata: {
          previousStage: lead.stage,
          nextStage: record.stage,
        },
      }),
    )
  }

  if (
    hasChanged(lead, record, 'name') ||
    hasChanged(lead, record, 'company') ||
    hasChanged(lead, record, 'source') ||
    hasChanged(lead, record, 'value') ||
    hasChanged(lead, record, 'followUpDue') ||
    hasChanged(lead, record, 'nextStep')
  ) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: 'preview',
        recordId: record.id,
        recordType: 'lead',
        action: 'updated',
        title: 'Lead updated',
        description: `${record.name} details were updated.`,
        metadata: {
          previousFollowUpDue: lead.followUpDue ?? null,
          nextFollowUpDue: record.followUpDue ?? null,
          previousNextStep: lead.nextStep,
          nextNextStep: record.nextStep,
        },
      }),
    )
  }

  if (
    hasChanged(lead, record, 'notes') ||
    lead.leadNotes !== record.leadNotes
  ) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: 'preview',
        recordId: record.id,
        recordType: 'lead',
        action: 'noteAdded',
        title: 'Lead Notes updated',
        description: `${record.name} lead notes were updated.`,
      }),
    )
  }

  if (events.length === 0) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: 'preview',
        recordId: record.id,
        recordType: 'lead',
        action: 'updated',
        title: 'Lead updated',
        description: `${record.name} was updated.`,
      }),
    )
  }

  return { record, events }
}

export function updateTaskRecordWithRules(
  task: TaskRecord,
  updates: Partial<TaskRecord>,
): MutationResult<TaskRecord> {
  const record: TaskRecord = { ...task, ...updates }
  const events: WorkspaceActivityRecord[] = []

  if (hasChanged(task, record, 'ownerId')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'task',
        action: 'assigned',
        title: 'Task assigned',
        description: `${record.title} assignment was updated.`,
        metadata: {
          previousOwnerId: task.ownerId,
          nextOwnerId: record.ownerId,
        },
      }),
    )
  }

  if (hasChanged(task, record, 'status')) {
    const taskWasReopened =
      task.status === 'Completed' && record.status !== 'Completed'
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'task',
        action:
          record.status === 'Completed'
            ? 'completed'
            : taskWasReopened
              ? 'statusChanged'
              : 'statusChanged',
        title:
          record.status === 'Completed'
            ? 'Task completed'
            : taskWasReopened
              ? 'Task reopened'
              : 'Task status changed',
        description: `${record.title} is now ${record.status}.`,
        metadata: {
          previousStatus: task.status,
          nextStatus: record.status,
        },
      }),
    )
  }

  if (hasChanged(task, record, 'dueDate')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'task',
        action: 'updated',
        title: 'Task due date changed',
        description: `${record.title} is now due ${record.dueDate}.`,
        metadata: {
          previousDueDate: task.dueDate,
          nextDueDate: record.dueDate,
        },
      }),
    )
  }

  if (events.length === 0) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'task',
        action: 'updated',
        title: 'Task updated',
        description: `${record.title} was updated.`,
      }),
    )
  }

  return { record, events }
}

export function updateServiceRequestRecordWithRules(
  request: WorkspaceServiceRequest,
  updates: Partial<WorkspaceServiceRequest>,
): MutationResult<WorkspaceServiceRequest> {
  const record: WorkspaceServiceRequest = { ...request, ...updates }
  const events: WorkspaceActivityRecord[] = []

  if (hasChanged(request, record, 'assignedToOwnerId')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'serviceRequest',
        action: 'assigned',
        title: 'Service request assigned',
        description: `${record.title} assignment was updated.`,
        metadata: {
          previousOwnerId: request.assignedToOwnerId,
          nextOwnerId: record.assignedToOwnerId,
        },
      }),
    )
  }

  if (hasChanged(request, record, 'status')) {
    const requestWasReopened =
      request.status === 'Completed' && record.status !== 'Completed'
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'serviceRequest',
        action:
          record.status === 'Completed'
            ? 'completed'
            : requestWasReopened
              ? 'statusChanged'
              : 'statusChanged',
        title:
          record.status === 'Completed'
            ? 'Service request completed'
            : requestWasReopened
              ? 'Service request reopened'
              : 'Service request status changed',
        description: `${record.title} is now ${record.status}.`,
        metadata: {
          previousStatus: request.status,
          nextStatus: record.status,
        },
      }),
    )
  }

  if (hasChanged(request, record, 'scheduledFor')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'serviceRequest',
        action: 'updated',
        title: request.scheduledFor
          ? 'Service request rescheduled'
          : 'Service request scheduled',
        description: record.scheduledFor
          ? `${record.title} is scheduled for ${record.scheduledFor}.`
          : `${record.title} schedule was cleared.`,
        metadata: {
          previousScheduledFor: request.scheduledFor,
          nextScheduledFor: record.scheduledFor,
        },
      }),
    )
  }

  if (events.length === 0) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId: record.workspaceId,
        recordId: record.id,
        recordType: 'serviceRequest',
        action: 'updated',
        title: 'Service request updated',
        description: `${record.title} was updated.`,
      }),
    )
  }

  return { record, events }
}

export function updateRevenueRecordWithRules<
  TRecord extends {
    id: string
    name: string
    client?: string
    company?: string
    clientId?: string
    leadId?: string
    sourceLeadId?: string
    stage: string
    value: number
    probability: number
    ownerId: string
    nextStep: string
    notes?: string
    opportunityNotes?: string
    saleNotes?: string
  },
>(
  workspaceId: string,
  recordType: 'opportunity' | 'sale',
  record: TRecord,
  updates: Partial<TRecord>,
): MutationResult<TRecord> {
  const nextRecord = { ...record, ...updates }
  const events: WorkspaceActivityRecord[] = []
  const relationshipMetadata = {
    opportunityId: nextRecord.id,
    leadId: nextRecord.leadId ?? nextRecord.sourceLeadId ?? null,
    sourceLeadId: nextRecord.sourceLeadId ?? nextRecord.leadId ?? null,
    clientId: nextRecord.clientId ?? null,
    companyName: nextRecord.company ?? nextRecord.client ?? null,
    clientName: nextRecord.client ?? nextRecord.company ?? null,
  }

  if (hasChanged(record, nextRecord, 'stage')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId,
        recordId: nextRecord.id,
        recordType,
        action: 'statusChanged',
        title:
          recordType === 'opportunity'
            ? 'Opportunity stage changed'
            : 'Deal stage changed',
        description: `${nextRecord.name} moved to ${nextRecord.stage}.`,
        metadata: {
          ...relationshipMetadata,
          previousStage: record.stage,
          nextStage: nextRecord.stage,
        },
      }),
    )
  }

  if (
    hasChanged(record, nextRecord, 'value') ||
    hasChanged(record, nextRecord, 'probability') ||
    hasChanged(record, nextRecord, 'nextStep')
  ) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId,
        recordId: nextRecord.id,
        recordType,
        action: 'updated',
        title:
          recordType === 'opportunity'
            ? 'Opportunity forecast updated'
            : 'Deal forecast updated',
        description: `${nextRecord.name} forecast details were updated.`,
        metadata: {
          ...relationshipMetadata,
          previousValue: record.value,
          nextValue: nextRecord.value,
          previousProbability: record.probability,
          nextProbability: nextRecord.probability,
          previousNextStep: record.nextStep,
          nextNextStep: nextRecord.nextStep,
        },
      }),
    )
  }

  if (hasChanged(record, nextRecord, 'ownerId')) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId,
        recordId: nextRecord.id,
        recordType,
        action: 'ownerChanged',
        title:
          recordType === 'opportunity'
            ? 'Opportunity owner changed'
            : 'Deal owner changed',
        description: `${nextRecord.name} owner was updated.`,
        metadata: {
          ...relationshipMetadata,
          previousOwnerId: record.ownerId,
          nextOwnerId: nextRecord.ownerId,
        },
      }),
    )
  }

  if (
    record.notes !== nextRecord.notes ||
    record.opportunityNotes !== nextRecord.opportunityNotes ||
    record.saleNotes !== nextRecord.saleNotes
  ) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId,
        recordId: nextRecord.id,
        recordType,
        action: 'noteAdded',
        title:
          recordType === 'opportunity'
            ? 'Opportunity Notes updated'
            : 'Sale Notes updated',
        description: `${nextRecord.name} notes were updated.`,
        metadata: relationshipMetadata,
      }),
    )
  }

  if (events.length === 0) {
    events.push(
      createWorkspaceActivityRecord({
        workspaceId,
        recordId: nextRecord.id,
        recordType,
        action: 'updated',
        title:
          recordType === 'opportunity' ? 'Opportunity updated' : 'Deal updated',
        description: `${nextRecord.name} was updated.`,
        metadata: relationshipMetadata,
      }),
    )
  }

  return { record: nextRecord, events }
}
