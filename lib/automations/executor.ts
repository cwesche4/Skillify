// lib/automations/executor.ts

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type {
  IntegrationProvider,
  IntegrationActionResult,
} from '@/lib/integrations/types'
import { upsertExternalRecord } from '@/lib/integrations/externalRecords'
import {
  getWorkspacePlan,
  resolveWorkspacePlan,
} from '@/lib/subscriptions/getWorkspacePlan'
import { getAutomationCapabilities } from '@/lib/automations/capabilities'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { nativeJobCompletedPayloadSchema } from '@/lib/domain-events/nativeJobEvents'
import {
  APPOINTMENT_REMINDER_DEFINITION_VERSION,
  SIMPLE_APPOINTMENT_REMINDER_SOURCE,
  appointmentReminderMetadataSchema,
  getAppointmentReminderOffsetMinutes,
  isAppointmentReminderEventType,
  isAppointmentReminderOccurrenceStateEligible,
} from '@/lib/automations/simpleAppointmentReminder'
import {
  SCHEDULE_CHANGE_DEFINITION_VERSION,
  SIMPLE_SCHEDULE_CHANGE_SOURCE,
  normalizedScheduleAssignmentKeys,
  scheduleChangeSnapshotSchema,
  scheduleChangeWorkMetadataSchema,
} from '@/lib/automations/simpleScheduleChangeNotification'
import { formatDateTime } from '@/lib/scheduling/schedulingFormatters'
import { decryptToken } from '@/lib/integrations/crypto'
import {
  recordFailure,
  resetBreakerIfNeeded,
  isBreakerOpen,
} from '@/lib/integrations/circuit'
import { normalizeCRMAuditMeta } from '@/lib/integrations/auditMeta'
import { classifyCRMError } from '@/lib/integrations/failureCategory'
import { shouldDeferCRMAction, buildDeferMeta } from '@/lib/integrations/defer'
import { classifyFailureSource } from '@/lib/automations/failureAttribution'
import {
  executeSchedulingWorkflowAction,
  isSchedulingRuntimeNode,
} from '@/lib/workflows/schedulingRuntime'
// Debug flag (env); default off. Never include raw CRM payloads.
const DEBUG_MODE = process.env.AUTOMATION_DEBUG_MODE === 'true'
import { classifyAutomationFailureSource } from '@/lib/automations/failure'
import { getAutomationExecutionPreconditionError } from '@/lib/automations/policy'

ensureIntegrationAdapters()

/* ------------------------------ Local Enums (Prisma 7) ------------------------------ */

export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export type AutomationStatus = 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

/* ------------------------------ Types ------------------------------ */

export type FlowNode = {
  id: string
  type?: string
  position?: { x: number; y: number }
  data?: Record<string, any>
}

export type FlowEdge = {
  id: string
  source: string
  target: string
}

export type FlowGraph = {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

interface RunOptions {
  expectedWorkspaceId: string
  triggerPayload?: any
  userProfileId?: string | null
  onRunCreated?: (runId: string) => Promise<void>
}

export interface NodeExecutionContext {
  triggerPayload?: any
  workspaceId?: string
  automationId?: string
  userProfileId?: string | null
  depth: number
  runState?: { crmActionCount: number }
  runId?: string
}

export interface NodeExecutionResult {
  output: Record<string, any>
  log: string
}

/* ------------------------------ Graph Helpers ------------------------------ */

function findStartNodes(flow: FlowGraph): FlowNode[] {
  const targets = new Set(flow.edges.map((e) => e.target))
  return flow.nodes.filter((n) => !targets.has(n.id))
}

function nextNodes(flow: FlowGraph, nodeId: string): FlowNode[] {
  const outgoing = flow.edges.filter((e) => e.source === nodeId)
  const idSet = new Set(outgoing.map((e) => e.target))
  return flow.nodes.filter((n) => idSet.has(n.id))
}

/* ------------------------------ Node Executor ------------------------------ */

export async function executeNode(
  type: string | undefined,
  data: any,
  context: NodeExecutionContext,
): Promise<NodeExecutionResult> {
  const registryNodeId =
    typeof data?.__registryNodeId === 'string' ? data.__registryNodeId : type
  if (isSchedulingRuntimeNode(registryNodeId)) {
    const result = await executeSchedulingWorkflowAction({
      registryNodeId,
      data: data ?? {},
      context,
    })
    return {
      output: result.output,
      log: result.log,
    }
  }

  switch (type) {
    case 'trigger':
      return {
        output: { triggered: true, payload: context.triggerPayload ?? null },
        log: 'Trigger fired.',
      }

    case 'ai-llm':
      return {
        output: { text: 'AI placeholder response (wire to OpenAI soon).' },
        log: `AI LLM executed, prompt: ${(data?.prompt ?? '').slice(0, 80)}`,
      }

    case 'ai-classifier':
      return {
        output: { label: (data?.classes ?? [])[0] ?? 'default' },
        log: `AI classifier labeled: ${(data?.classes ?? [])[0] ?? 'default'}`,
      }

    case 'ai-splitter':
      return {
        output: { splitKey: 'A' },
        log: 'AI splitter → path A.',
      }

    case 'or-path':
      return {
        output: { path: 'A' },
        log: 'OR path selected: A',
      }

    case 'delay':
      return {
        output: { completed: true },
        log: 'Delay executed (stub). Scheduler coming soon.',
      }

    case 'webhook':
      return {
        output: { status: 'queued' },
        log: `Webhook queued → ${data?.url ?? 'no-url'}`,
      }

    case 'crm-trigger':
      return {
        output: {
          provider: data?.provider,
          objectType: data?.objectType,
          payload: context.triggerPayload ?? null,
        },
        log: `CRM trigger received (${data?.provider ?? 'crm'})`,
      }

    case 'simple-new-lead-trigger':
      return {
        output: {
          source: context.triggerPayload?.source ?? 'external-crm',
          payload: context.triggerPayload ?? null,
        },
        log:
          context.triggerPayload?.source === 'skillify-native'
            ? 'Native Skillify Lead event received.'
            : `CRM contact event received (${context.triggerPayload?.provider ?? 'crm'}).`,
      }

    case 'simple-lead-follow-up-trigger':
      return {
        output: {
          source: context.triggerPayload?.source ?? null,
          payload: context.triggerPayload ?? null,
        },
        log: 'Native Skillify Lead follow-up is due.',
      }

    case 'simple-job-completed-trigger':
      return {
        output: {
          source: context.triggerPayload?.source ?? null,
          payload: context.triggerPayload ?? null,
        },
        log: 'Native Skillify Job completion received.',
      }

    case 'simple-appointment-reminder-trigger':
      return {
        output: {
          source: context.triggerPayload?.source ?? null,
          payload: context.triggerPayload ?? null,
        },
        log: 'Native Skillify appointment reminder is due.',
      }

    case 'simple-schedule-change-trigger':
      return {
        output: {
          source: context.triggerPayload?.source ?? null,
          payload: context.triggerPayload ?? null,
        },
        log: 'Native Skillify schedule change received.',
      }

    case 'simple-in-app-notification': {
      if (data?.definitionKey !== 'new-lead-alert') {
        throw new Error('Unsupported Simple Automation notification action.')
      }
      if (!context.workspaceId || !context.automationId) {
        throw new Error('Simple notification requires workspace context.')
      }
      const eventKey =
        typeof context.triggerPayload?.simpleEventKey === 'string'
          ? context.triggerPayload.simpleEventKey
          : null
      if (!eventKey) {
        throw new Error('Simple notification is missing its event identity.')
      }

      const managedAutomation = await prisma.automation.findFirst({
        where: {
          id: context.automationId,
          workspaceId: context.workspaceId,
          status: 'ACTIVE',
          simpleAutomationInstallation: {
            is: { definitionKey: 'new-lead-alert', removedAt: null },
          },
        },
        select: {
          id: true,
          simpleAutomationInstallation: { select: { id: true } },
        },
      })
      if (!managedAutomation) {
        throw new Error('Managed Simple Automation is no longer active.')
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: {
          slug: true,
          ownerId: true,
          businessName: true,
          name: true,
          businessModel: true,
        },
      })
      if (!workspace) throw new Error('Workspace not found for notification.')

      const plan = await getWorkspacePlan(context.workspaceId)
      const isNative = context.triggerPayload?.source === 'skillify-native'
      const eligible = isNative
        ? workspace.businessModel ===
            WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
          getAutomationCapabilities(plan).canUseStarterAutomations
        : plan === 'Elite'
      if (!eligible) {
        throw new Error('Managed Simple Automation is no longer eligible.')
      }

      const installationId = managedAutomation.simpleAutomationInstallation?.id
      if (!installationId || !context.runId) {
        throw new Error(
          'Managed Simple Automation dispatch is no longer current.',
        )
      }
      const currentDispatch = await prisma.simpleAutomationDispatch.findUnique({
        where: {
          installationId_eventKey: { installationId, eventKey },
        },
        select: { status: true, runId: true },
      })
      if (
        currentDispatch?.status !== 'PROCESSING' ||
        currentDispatch.runId !== context.runId
      ) {
        throw new Error(
          'Managed Simple Automation dispatch is no longer current.',
        )
      }

      const raw =
        context.triggerPayload?.raw &&
        typeof context.triggerPayload.raw === 'object'
          ? context.triggerPayload.raw
          : {}
      const leadName =
        raw.displayName ||
        raw.firstname ||
        raw.firstName ||
        raw.name ||
        raw.email ||
        'A new lead'
      const provider = String(context.triggerPayload?.provider ?? 'CRM')
      const deduplicationKey = `simple:new-lead-alert:${eventKey}`
      const notification = await prisma.schedulingNotification.upsert({
        where: {
          workspaceId_deduplicationKey: {
            workspaceId: context.workspaceId,
            deduplicationKey,
          },
        },
        create: {
          workspaceId: context.workspaceId,
          key: 'simple.new-lead-alert',
          deduplicationKey,
          category: 'EVENT_CREATED',
          priority: 'HIGH',
          recipientType: 'workspaceOwner',
          recipientUserId: workspace.ownerId,
          title: 'New lead received',
          body: isNative
            ? `${String(leadName)} was added to Skillify.`
            : `${String(leadName)} was created in ${provider}.`,
          deepLink: isNative
            ? `/dashboard/${workspace.slug}/leads`
            : `/dashboard/${workspace.slug}/settings/integrations`,
          entityType: isNative ? 'Lead' : 'ExternalRecord',
          entityId: String(context.triggerPayload?.externalId ?? eventKey),
          relatedRecordType: isNative ? 'lead' : 'externalRecord',
          relatedRecordId: String(
            context.triggerPayload?.externalId ?? eventKey,
          ),
          metadata: {
            automationId: context.automationId,
            definitionKey: data.definitionKey,
            provider,
            source: isNative ? 'skillify-native' : 'external-crm',
            ...(isNative && context.triggerPayload?.domainEventId
              ? { domainEventId: context.triggerPayload.domainEventId }
              : {}),
          },
        },
        update: {},
        select: { id: true },
      })

      return {
        output: { notificationId: notification.id, delivered: true },
        log: 'In-app new lead alert created for the workspace owner.',
      }
    }

    case 'simple-schedule-change-notification': {
      if (
        data?.definitionKey !== 'schedule-change-notification' ||
        data?.definitionVersion !== SCHEDULE_CHANGE_DEFINITION_VERSION ||
        data?.channel !== 'in-app' ||
        data?.recipient !== 'appointment-assignees-or-owner'
      ) {
        throw new Error('Unsupported Simple Automation notification action.')
      }
      if (!context.workspaceId || !context.automationId || !context.runId) {
        throw new Error('Simple notification requires workspace context.')
      }
      const workspaceId = context.workspaceId
      const automationId = context.automationId
      const runId = context.runId
      const eventKey =
        typeof context.triggerPayload?.simpleEventKey === 'string'
          ? context.triggerPayload.simpleEventKey
          : null
      const reminderScheduleId =
        typeof context.triggerPayload?.reminderScheduleId === 'string'
          ? context.triggerPayload.reminderScheduleId
          : null
      const reminderClaimedBy =
        typeof context.triggerPayload?.reminderClaimedBy === 'string'
          ? context.triggerPayload.reminderClaimedBy
          : null
      const outboxEventId =
        typeof context.triggerPayload?.outboxEventId === 'string'
          ? context.triggerPayload.outboxEventId
          : null
      const occurrenceId =
        typeof context.triggerPayload?.externalId === 'string'
          ? context.triggerPayload.externalId
          : null
      const metadata = scheduleChangeWorkMetadataSchema.safeParse(
        context.triggerPayload?.raw,
      )
      if (
        !eventKey ||
        !reminderScheduleId ||
        !reminderClaimedBy ||
        !outboxEventId ||
        !occurrenceId ||
        !metadata.success ||
        metadata.data.outboxEventId !== outboxEventId ||
        context.triggerPayload?.source !== 'skillify-native' ||
        context.triggerPayload?.event !== 'scheduling.schedule.changed'
      ) {
        throw new Error(
          'Schedule Change Notification is missing its change identity.',
        )
      }
      const change = metadata.data.change
      if (
        metadata.data.automationId !== automationId ||
        change.eventId !== occurrenceId
      ) {
        throw new Error('Schedule Change Notification workspace does not match.')
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true, ownerId: true, businessModel: true },
      })
      if (!workspace) {
        throw new Error(
          'Managed Schedule Change Notification is no longer current.',
        )
      }
      const plan = await getWorkspacePlan(workspaceId)
      if (
        (workspace.businessModel !==
          WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
          workspace.businessModel !==
            WorkspaceBusinessModel.CONSULTATIVE_SALES) ||
        !getAutomationCapabilities(plan).canUseStarterAutomations
      ) {
        throw new Error('Managed Simple Automation is no longer eligible.')
      }

      const delivery = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`,
        )
        const lockedWorkspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            slug: true,
            ownerId: true,
            businessModel: true,
            subscription: { select: { id: true, plan: true } },
            owner: {
              select: {
                subscription: { select: { id: true, plan: true } },
              },
            },
          },
        })
        if (
          !lockedWorkspace ||
          (lockedWorkspace.businessModel !==
            WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
            lockedWorkspace.businessModel !==
              WorkspaceBusinessModel.CONSULTATIVE_SALES)
        ) {
          throw new Error('Managed Simple Automation is no longer eligible.')
        }
        const subscriptionIds = [
          lockedWorkspace.subscription?.id,
          lockedWorkspace.owner.subscription?.id,
        ]
          .filter((id): id is string => Boolean(id))
          .sort()
        if (subscriptionIds.length > 0) {
          await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "Subscription" WHERE "id" IN (${Prisma.join(subscriptionIds)}) ORDER BY "id" FOR UPDATE`,
          )
        }
        const lockedPlanWorkspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            subscription: { select: { plan: true } },
            owner: { select: { subscription: { select: { plan: true } } } },
          },
        })
        const lockedPlan = resolveWorkspacePlan({
          workspaceSubscriptionPlan: lockedPlanWorkspace?.subscription?.plan,
          ownerSubscriptionPlan:
            lockedPlanWorkspace?.owner.subscription?.plan,
        })
        if (!getAutomationCapabilities(lockedPlan).canUseStarterAutomations) {
          throw new Error('Managed Simple Automation is no longer eligible.')
        }
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Automation" WHERE "id" = ${automationId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const currentAutomation = await tx.automation.findFirst({
          where: {
            id: automationId,
            workspaceId,
            status: 'ACTIVE',
            simpleAutomationInstallation: {
              is: {
                id: metadata.data.installationId,
                definitionKey: 'schedule-change-notification',
                definitionVersion: SCHEDULE_CHANGE_DEFINITION_VERSION,
                removedAt: null,
              },
            },
          },
          select: {
            simpleAutomationInstallation: {
              select: { id: true, config: true },
            },
          },
        })
        const installation = currentAutomation?.simpleAutomationInstallation
        const config =
          installation?.config &&
          typeof installation.config === 'object' &&
          !Array.isArray(installation.config)
            ? (installation.config as Record<string, unknown>)
            : {}
        const configuredChanges = Array.isArray(config.changes)
          ? config.changes.filter(
              (value): value is string => typeof value === 'string',
            )
          : []
        if (
          !installation ||
          config['notification-channel'] !== 'in-app' ||
          config.recipient !== 'appointment-assignees-or-owner' ||
          !change.changeTypes.some((type) => configuredChanges.includes(type))
        ) {
          throw new Error(
            'Managed Schedule Change Notification is no longer current.',
          )
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SimpleAutomationDispatch" WHERE "installationId" = ${installation.id} AND "eventKey" = ${eventKey} FOR UPDATE`,
        )
        const lockedDispatch = await tx.simpleAutomationDispatch.findUnique({
          where: {
            installationId_eventKey: {
              installationId: installation.id,
              eventKey,
            },
          },
          select: { status: true, runId: true },
        })
        if (
          lockedDispatch?.status !== 'PROCESSING' ||
          lockedDispatch.runId !== runId
        ) {
          throw new Error(
            'Managed Simple Automation dispatch is no longer current.',
          )
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SchedulingReminderSchedule" WHERE "id" = ${reminderScheduleId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const reminder = await tx.schedulingReminderSchedule.findFirst({
          where: {
            id: reminderScheduleId,
            workspaceId,
            schedulingEventId: occurrenceId,
            source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
            status: 'PROCESSING',
          },
          select: { metadata: true, claimedBy: true },
        })
        const persistedWork = scheduleChangeWorkMetadataSchema.safeParse(
          reminder?.metadata,
        )
        if (
          !persistedWork.success ||
          persistedWork.data.outboxEventId !== outboxEventId ||
          persistedWork.data.change.revision !== change.revision ||
          reminder?.claimedBy !== reminderClaimedBy
        ) {
          if (
            persistedWork.success &&
            reminder?.claimedBy !== reminderClaimedBy
          ) {
            throw new Error('Schedule Change worker claim was lost.')
          }
          throw new Error(
            'Managed Schedule Change Notification is no longer current.',
          )
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "DomainOutboxEvent" WHERE "id" = ${outboxEventId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const outbox = await tx.domainOutboxEvent.findFirst({
          where: {
            id: outboxEventId,
            workspaceId,
            topic: { startsWith: 'scheduling.' },
            status: 'PROCESSED',
          },
          select: { payload: true },
        })
        const outboxPayload =
          outbox?.payload &&
          typeof outbox.payload === 'object' &&
          !Array.isArray(outbox.payload)
            ? (outbox.payload as Record<string, unknown>)
            : {}
        const persistedChange = scheduleChangeSnapshotSchema.safeParse(
          outboxPayload.scheduleChange,
        )
        if (
          !persistedChange.success ||
          persistedChange.data.revision !== change.revision
        ) {
          throw new Error(
            'Managed Schedule Change Notification is no longer current.',
          )
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${occurrenceId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const occurrence = await tx.schedulingEvent.findFirst({
          where: { id: occurrenceId, workspaceId },
          include: { assignments: true },
        })
        const currentAssignments = occurrence
          ? normalizedScheduleAssignmentKeys(occurrence.assignments)
          : []
        if (
          !occurrence ||
          occurrence.deletedAt ||
          !isAppointmentReminderEventType(occurrence.eventTypeKey) ||
          ['MASTER', 'SUPERSEDED', 'DELETED'].includes(
            occurrence.occurrenceState ?? '',
          ) ||
          occurrence.startsAtUtc.toISOString() !== change.after.startsAtUtc ||
          String(occurrence.status).toLowerCase() !== change.after.status ||
          (occurrence.occurrenceOriginalAt?.toISOString() ?? null) !==
            change.occurrenceOriginalAt ||
          currentAssignments.length !== change.after.assignmentKeys.length ||
          currentAssignments.some(
            (key, index) => key !== change.after.assignmentKeys[index],
          )
        ) {
          throw new Error(
            'Managed Schedule Change Notification is no longer current.',
          )
        }

        const directMemberIds = occurrence.assignments
          .map((assignment) => assignment.workspaceMemberId)
          .filter((id): id is string => Boolean(id))
        const teamIds = occurrence.assignments
          .map((assignment) => assignment.teamId)
          .filter((id): id is string => Boolean(id))
        const [directMembers, teams] = await Promise.all([
          tx.workspaceMember.findMany({
            where: { workspaceId, id: { in: directMemberIds } },
            select: { id: true, userId: true },
          }),
          tx.workspaceTeam.findMany({
            where: {
              workspaceId,
              id: { in: teamIds },
              isActive: true,
              archivedAt: null,
            },
            include: {
              members: {
                where: { workspaceId },
                include: {
                  workspaceMember: {
                    select: { id: true, userId: true, workspaceId: true },
                  },
                },
              },
            },
          }),
        ])
        const recipients = new Map<
          string,
          { workspaceMemberId: string | null; userId: string }
        >()
        for (const member of directMembers) {
          recipients.set(member.id, {
            workspaceMemberId: member.id,
            userId: member.userId,
          })
        }
        for (const team of teams) {
          for (const membership of team.members) {
            const member = membership.workspaceMember
            if (member.workspaceId !== workspaceId) continue
            recipients.set(member.id, {
              workspaceMemberId: member.id,
              userId: member.userId,
            })
          }
        }
        if (recipients.size === 0) {
          recipients.set('workspace-owner', {
            workspaceMemberId: null,
            userId: lockedWorkspace.ownerId,
          })
        }

        const beforeTime = formatDateTime(
          change.before.startsAtUtc,
          change.timezone,
        )
        const afterTime = formatDateTime(
          change.after.startsAtUtc,
          change.timezone,
        )
        const body = change.changeTypes.includes('canceled')
          ? `Schedule changed: ${change.title} was canceled.`
          : change.changeTypes.includes('time')
            ? `Schedule changed: ${change.title} moved from ${beforeTime} to ${afterTime}.${change.changeTypes.includes('assignment') ? ' Assignment also changed.' : ''}`
            : `Schedule changed: ${change.title} assignment changed.`
        const notificationIds: string[] = []
        for (const [recipientKey, recipient] of recipients) {
          const deduplicationKey =
            `simple:schedule-change:${eventKey}:${recipientKey}`
          const notification = await tx.schedulingNotification.upsert({
            where: {
              workspaceId_deduplicationKey: { workspaceId, deduplicationKey },
            },
            create: {
              workspaceId,
              key: 'simple.schedule-change',
              deduplicationKey,
              category: 'EVENT_UPDATED',
              priority: 'HIGH',
              recipientType: recipient.workspaceMemberId
                ? 'workspaceMember'
                : 'workspaceOwner',
              recipientUserId: recipient.userId,
              recipientWorkspaceMemberId: recipient.workspaceMemberId,
              title: 'Schedule changed',
              body,
              deepLink: `/dashboard/${lockedWorkspace.slug}/scheduling`,
              entityType: 'SchedulingEvent',
              entityId: occurrence.id,
              schedulingEventId: occurrence.id,
              occurrenceId: occurrence.occurrenceOriginalAt
                ? occurrence.id
                : null,
              seriesId: occurrence.recurrenceSeriesId,
              relatedRecordType: occurrence.linkedRecordType,
              relatedRecordId: occurrence.linkedRecordId,
              metadata: {
                automationId,
                definitionKey: data.definitionKey,
                source: 'skillify-native',
                outboxEventId,
                changeRevision: change.revision,
                changeTypes: change.changeTypes,
                scope: change.scope,
              },
            },
            update: {},
            select: { id: true },
          })
          notificationIds.push(notification.id)
        }
        return { notificationIds, recipientCount: recipients.size }
      })

      return {
        output: {
          notificationIds: delivery.notificationIds,
          delivered: true,
          recipientCount: delivery.recipientCount,
        },
        log: `In-app schedule change created for ${delivery.recipientCount} internal recipient(s).`,
      }
    }

    case 'simple-appointment-reminder-notification': {
      if (
        data?.definitionKey !== 'appointment-reminder' ||
        data?.definitionVersion !== APPOINTMENT_REMINDER_DEFINITION_VERSION ||
        data?.channel !== 'in-app' ||
        data?.recipient !== 'appointment-assignees-or-owner'
      ) {
        throw new Error('Unsupported Simple Automation notification action.')
      }
      if (!context.workspaceId || !context.automationId || !context.runId) {
        throw new Error('Simple notification requires workspace context.')
      }
      const workspaceId = context.workspaceId
      const automationId = context.automationId
      const runId = context.runId
      const eventKey =
        typeof context.triggerPayload?.simpleEventKey === 'string'
          ? context.triggerPayload.simpleEventKey
          : null
      const reminderScheduleId =
        typeof context.triggerPayload?.reminderScheduleId === 'string'
          ? context.triggerPayload.reminderScheduleId
          : null
      const reminderClaimedBy =
        typeof context.triggerPayload?.reminderClaimedBy === 'string'
          ? context.triggerPayload.reminderClaimedBy
          : null
      const occurrenceId =
        typeof context.triggerPayload?.externalId === 'string'
          ? context.triggerPayload.externalId
          : null
      const metadata = appointmentReminderMetadataSchema.safeParse(
        context.triggerPayload?.raw,
      )
      if (
        !eventKey ||
        !reminderScheduleId ||
        !reminderClaimedBy ||
        !occurrenceId ||
        !metadata.success ||
        context.triggerPayload?.source !== 'skillify-native' ||
        context.triggerPayload?.event !== 'scheduling.reminder.due'
      ) {
        throw new Error(
          'Appointment Reminder is missing its occurrence identity.',
        )
      }
      if (metadata.data.automationId !== automationId) {
        throw new Error('Appointment Reminder workspace does not match.')
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true, ownerId: true, businessModel: true },
      })
      if (!workspace) {
        throw new Error('Managed Appointment Reminder is no longer current.')
      }
      const plan = await getWorkspacePlan(workspaceId)
      if (
        (workspace.businessModel !==
          WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
          workspace.businessModel !==
            WorkspaceBusinessModel.CONSULTATIVE_SALES) ||
        !getAutomationCapabilities(plan).canUseStarterAutomations
      ) {
        throw new Error('Managed Simple Automation is no longer eligible.')
      }

      const delivery = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`,
        )
        const lockedWorkspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { slug: true, ownerId: true, businessModel: true },
        })
        if (
          !lockedWorkspace ||
          (lockedWorkspace.businessModel !==
            WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
            lockedWorkspace.businessModel !==
              WorkspaceBusinessModel.CONSULTATIVE_SALES)
        ) {
          throw new Error('Managed Simple Automation is no longer eligible.')
        }
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Automation" WHERE "id" = ${automationId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const currentAutomation = await tx.automation.findFirst({
          where: {
            id: automationId,
            workspaceId,
            status: 'ACTIVE',
            simpleAutomationInstallation: {
              is: {
                id: metadata.data.installationId,
                definitionKey: 'appointment-reminder',
                definitionVersion: APPOINTMENT_REMINDER_DEFINITION_VERSION,
                removedAt: null,
              },
            },
          },
          select: {
            simpleAutomationInstallation: {
              select: { id: true, config: true },
            },
          },
        })
        const installation = currentAutomation?.simpleAutomationInstallation
        if (
          !installation ||
          getAppointmentReminderOffsetMinutes(installation.config) !==
            metadata.data.offsetMinutes
        ) {
          throw new Error(
            'Managed Appointment Reminder is no longer current.',
          )
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SimpleAutomationDispatch" WHERE "installationId" = ${installation.id} AND "eventKey" = ${eventKey} FOR UPDATE`,
        )
        const lockedDispatch = await tx.simpleAutomationDispatch.findUnique({
          where: {
            installationId_eventKey: {
              installationId: installation.id,
              eventKey,
            },
          },
          select: { status: true, runId: true },
        })
        if (
          lockedDispatch?.status !== 'PROCESSING' ||
          lockedDispatch.runId !== runId
        ) {
          throw new Error(
            'Managed Simple Automation dispatch is no longer current.',
          )
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SchedulingReminderSchedule" WHERE "id" = ${reminderScheduleId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const reminder = await tx.schedulingReminderSchedule.findFirst({
          where: {
            id: reminderScheduleId,
            workspaceId,
            schedulingEventId: occurrenceId,
            source: SIMPLE_APPOINTMENT_REMINDER_SOURCE,
            status: 'PROCESSING',
          },
          select: {
            metadata: true,
            eventStartsAtUtc: true,
            offsetMinutes: true,
            claimedBy: true,
          },
        })
        const persistedMetadata = appointmentReminderMetadataSchema.safeParse(
          reminder?.metadata,
        )
        if (
          !persistedMetadata.success ||
          persistedMetadata.data.scheduleRevision !==
            metadata.data.scheduleRevision ||
          reminder?.eventStartsAtUtc?.getTime() !==
            new Date(metadata.data.eventStartsAtUtc).getTime() ||
          reminder.offsetMinutes !== metadata.data.offsetMinutes ||
          reminder.claimedBy !== reminderClaimedBy
        ) {
          if (
            persistedMetadata.success &&
            reminder?.claimedBy !== reminderClaimedBy
          ) {
            throw new Error('Appointment Reminder worker claim was lost.')
          }
          throw new Error('Managed Appointment Reminder is no longer current.')
        }

        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${occurrenceId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const occurrence = await tx.schedulingEvent.findFirst({
          where: { id: occurrenceId, workspaceId },
          include: { assignments: true },
        })
        if (
          !occurrence ||
          occurrence.deletedAt ||
          !isAppointmentReminderEventType(occurrence.eventTypeKey) ||
          !isAppointmentReminderOccurrenceStateEligible(
            occurrence.occurrenceState,
          ) ||
          (occurrence.status !== 'SCHEDULED' &&
            occurrence.status !== 'CONFIRMED') ||
          occurrence.startsAtUtc.getTime() !==
            new Date(metadata.data.eventStartsAtUtc).getTime() ||
          occurrence.startsAtUtc <= new Date() ||
          (occurrence.occurrenceOriginalAt?.toISOString() ?? null) !==
            metadata.data.occurrenceOriginalAt
        ) {
          throw new Error(
            'Managed Appointment Reminder is no longer current.',
          )
        }

        const directMemberIds = occurrence.assignments
          .map((assignment) => assignment.workspaceMemberId)
          .filter((id): id is string => Boolean(id))
        const teamIds = occurrence.assignments
          .map((assignment) => assignment.teamId)
          .filter((id): id is string => Boolean(id))
        const [directMembers, teams] = await Promise.all([
          tx.workspaceMember.findMany({
            where: { workspaceId, id: { in: directMemberIds } },
            select: { id: true, userId: true },
          }),
          tx.workspaceTeam.findMany({
            where: {
              workspaceId,
              id: { in: teamIds },
              isActive: true,
              archivedAt: null,
            },
            include: {
              members: {
                where: { workspaceId },
                include: {
                  workspaceMember: {
                    select: { id: true, userId: true, workspaceId: true },
                  },
                },
              },
            },
          }),
        ])
        const recipients = new Map<
          string,
          { workspaceMemberId: string | null; userId: string }
        >()
        for (const member of directMembers) {
          recipients.set(member.id, {
            workspaceMemberId: member.id,
            userId: member.userId,
          })
        }
        for (const team of teams) {
          for (const membership of team.members) {
            const member = membership.workspaceMember
            if (member.workspaceId !== workspaceId) continue
            recipients.set(member.id, {
              workspaceMemberId: member.id,
              userId: member.userId,
            })
          }
        }
        if (recipients.size === 0) {
          recipients.set('workspace-owner', {
            workspaceMemberId: null,
            userId: lockedWorkspace.ownerId,
          })
        }

        const finalPlan = await getWorkspacePlan(workspaceId)
        if (!getAutomationCapabilities(finalPlan).canUseStarterAutomations) {
          throw new Error('Managed Simple Automation is no longer eligible.')
        }

        const offsetLabel =
          metadata.data.offsetMinutes === 24 * 60
            ? '1 day'
            : metadata.data.offsetMinutes === 60
              ? '1 hour'
              : `${metadata.data.offsetMinutes} minutes`
        const contextLabel = occurrence.linkedRecordLabel
          ? `${occurrence.title} with ${occurrence.linkedRecordLabel}`
          : occurrence.title
        const notificationIds: string[] = []
        for (const [recipientKey, recipient] of recipients) {
          const deduplicationKey =
            `simple:appointment-reminder:${eventKey}:${recipientKey}`
          const notification = await tx.schedulingNotification.upsert({
            where: {
              workspaceId_deduplicationKey: {
                workspaceId,
                deduplicationKey,
              },
            },
            create: {
              workspaceId,
              key: 'simple.appointment-reminder',
              deduplicationKey,
              category: 'REMINDER',
              priority: 'HIGH',
              recipientType: recipient.workspaceMemberId
                ? 'workspaceMember'
                : 'workspaceOwner',
              recipientUserId: recipient.userId,
              recipientWorkspaceMemberId: recipient.workspaceMemberId,
              title: 'Appointment reminder',
              body: `Appointment in ${offsetLabel}: ${contextLabel}.`,
              deepLink: `/dashboard/${lockedWorkspace.slug}/scheduling`,
              entityType: 'SchedulingEvent',
              entityId: occurrence.id,
              schedulingEventId: occurrence.id,
              occurrenceId: occurrence.occurrenceOriginalAt
                ? occurrence.id
                : null,
              seriesId: occurrence.recurrenceSeriesId,
              relatedRecordType: occurrence.linkedRecordType,
              relatedRecordId: occurrence.linkedRecordId,
              metadata: {
                automationId,
                definitionKey: data.definitionKey,
                source: 'skillify-native',
                reminderScheduleId,
                scheduleRevision: metadata.data.scheduleRevision,
                eventStartsAtUtc: metadata.data.eventStartsAtUtc,
                offsetMinutes: metadata.data.offsetMinutes,
              },
            },
            update: {},
            select: { id: true },
          })
          notificationIds.push(notification.id)
        }
        return { notificationIds, recipientCount: recipients.size }
      })

      return {
        output: {
          notificationIds: delivery.notificationIds,
          delivered: true,
          recipientCount: delivery.recipientCount,
        },
        log: `In-app appointment reminder created for ${delivery.recipientCount} internal recipient(s).`,
      }
    }

    case 'simple-lead-follow-up-notification': {
      if (data?.definitionKey !== 'lead-follow-up') {
        throw new Error('Unsupported Simple Automation notification action.')
      }
      if (!context.workspaceId || !context.automationId || !context.runId) {
        throw new Error('Simple notification requires workspace context.')
      }
      const workspaceId = context.workspaceId
      const automationId = context.automationId
      const runId = context.runId
      const eventKey =
        typeof context.triggerPayload?.simpleEventKey === 'string'
          ? context.triggerPayload.simpleEventKey
          : null
      const leadId =
        typeof context.triggerPayload?.externalId === 'string'
          ? context.triggerPayload.externalId
          : null
      const scheduledFor =
        typeof context.triggerPayload?.scheduledFor === 'string'
          ? new Date(context.triggerPayload.scheduledFor)
          : null
      if (
        !eventKey ||
        !leadId ||
        !scheduledFor ||
        Number.isNaN(scheduledFor.getTime()) ||
        context.triggerPayload?.source !== 'skillify-native' ||
        context.triggerPayload?.event !== 'lead.follow_up_due'
      ) {
        throw new Error('Lead Follow-Up is missing its schedule identity.')
      }

      const managedAutomation = await prisma.automation.findFirst({
        where: {
          id: automationId,
          workspaceId,
          status: 'ACTIVE',
          simpleAutomationInstallation: {
            is: { definitionKey: 'lead-follow-up', removedAt: null },
          },
        },
        select: {
          id: true,
          simpleAutomationInstallation: { select: { id: true } },
        },
      })
      if (!managedAutomation) {
        throw new Error('Managed Simple Automation is no longer active.')
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true, ownerId: true, businessModel: true },
      })
      if (!workspace) throw new Error('Workspace not found for notification.')
      const plan = await getWorkspacePlan(workspaceId)
      if (
        workspace.businessModel !==
          WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS ||
        !getAutomationCapabilities(plan).canUseStarterAutomations
      ) {
        throw new Error('Managed Simple Automation is no longer eligible.')
      }

      const installationId = managedAutomation.simpleAutomationInstallation?.id
      if (!installationId) {
        throw new Error(
          'Managed Simple Automation dispatch is no longer current.',
        )
      }
      const currentDispatch = await prisma.simpleAutomationDispatch.findUnique({
        where: {
          installationId_eventKey: { installationId, eventKey },
        },
        select: { status: true, runId: true },
      })
      if (
        currentDispatch?.status !== 'PROCESSING' ||
        currentDispatch.runId !== runId
      ) {
        throw new Error(
          'Managed Simple Automation dispatch is no longer current.',
        )
      }

      const delivery = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Automation" WHERE "id" = ${automationId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const currentAutomation = await tx.automation.findFirst({
          where: {
            id: automationId,
            workspaceId,
            status: 'ACTIVE',
            simpleAutomationInstallation: {
              is: { definitionKey: 'lead-follow-up', removedAt: null },
            },
          },
          select: {
            simpleAutomationInstallation: { select: { id: true } },
          },
        })
        if (
          currentAutomation?.simpleAutomationInstallation?.id !== installationId
        ) {
          throw new Error('Managed Simple Automation is no longer active.')
        }
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SimpleAutomationDispatch" WHERE "installationId" = ${installationId} AND "eventKey" = ${eventKey} FOR UPDATE`,
        )
        const lockedDispatch = await tx.simpleAutomationDispatch.findUnique({
          where: {
            installationId_eventKey: { installationId, eventKey },
          },
          select: { status: true, runId: true },
        })
        if (
          lockedDispatch?.status !== 'PROCESSING' ||
          lockedDispatch.runId !== runId
        ) {
          throw new Error(
            'Managed Simple Automation dispatch is no longer current.',
          )
        }
        const locked = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Lead" WHERE "id" = ${leadId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        if (locked.length !== 1) {
          throw new Error(
            'Managed Lead Follow-Up schedule is no longer current.',
          )
        }
        const lead = await tx.lead.findFirst({
          where: { id: leadId, workspaceId },
          select: {
            displayName: true,
            nextStep: true,
            stage: true,
            followUpAt: true,
            convertedCustomerId: true,
            archivedAt: true,
            assignedMemberId: true,
            assignee: { select: { userId: true, workspaceId: true } },
          },
        })
        if (
          !lead ||
          lead.archivedAt ||
          lead.convertedCustomerId ||
          lead.stage === 'WON' ||
          lead.stage === 'LOST' ||
          lead.followUpAt?.getTime() !== scheduledFor.getTime()
        ) {
          throw new Error(
            'Managed Lead Follow-Up schedule is no longer current.',
          )
        }

        const useAssignee = data?.recipient === 'lead-assignee-or-owner'
        const validAssignee =
          useAssignee &&
          lead.assignedMemberId &&
          lead.assignee?.workspaceId === workspaceId
            ? lead.assignee
            : null
        const recipientUserId = validAssignee?.userId ?? workspace.ownerId
        const recipientWorkspaceMemberId = validAssignee
          ? lead.assignedMemberId
          : null
        const deduplicationKey = `simple:lead-follow-up:${eventKey}`
        const notification = await tx.schedulingNotification.upsert({
          where: {
            workspaceId_deduplicationKey: {
              workspaceId,
              deduplicationKey,
            },
          },
          create: {
            workspaceId,
            key: 'simple.lead-follow-up',
            deduplicationKey,
            category: 'REMINDER',
            priority: 'HIGH',
            recipientType: validAssignee ? 'workspaceMember' : 'workspaceOwner',
            recipientUserId,
            recipientWorkspaceMemberId,
            title: 'Lead follow-up due',
            body: lead.nextStep
              ? `${lead.displayName}: ${lead.nextStep}`
              : `${lead.displayName} is due for follow-up.`,
            deepLink: `/dashboard/${workspace.slug}/leads`,
            entityType: 'Lead',
            entityId: leadId,
            relatedRecordType: 'lead',
            relatedRecordId: leadId,
            metadata: {
              automationId,
              definitionKey: data.definitionKey,
              source: 'skillify-native',
              domainEventId: context.triggerPayload?.domainEventId,
              scheduleRevision: context.triggerPayload?.scheduleRevision,
              scheduledFor: context.triggerPayload?.scheduledFor,
            },
          },
          update: {},
          select: { id: true },
        })
        return { notification, usedAssignee: Boolean(validAssignee) }
      })

      return {
        output: { notificationId: delivery.notification.id, delivered: true },
        log: delivery.usedAssignee
          ? 'In-app Lead follow-up reminder created for the current assignee.'
          : 'In-app Lead follow-up reminder created for the workspace owner.',
      }
    }

    case 'simple-job-completion-notification': {
      if (data?.definitionKey !== 'job-completion-message') {
        throw new Error('Unsupported Simple Automation notification action.')
      }
      if (!context.workspaceId || !context.automationId || !context.runId) {
        throw new Error('Simple notification requires workspace context.')
      }
      const workspaceId = context.workspaceId
      const automationId = context.automationId
      const runId = context.runId
      const eventKey =
        typeof context.triggerPayload?.simpleEventKey === 'string'
          ? context.triggerPayload.simpleEventKey
          : null
      const domainEventId =
        typeof context.triggerPayload?.domainEventId === 'string'
          ? context.triggerPayload.domainEventId
          : null
      const parsed = nativeJobCompletedPayloadSchema.safeParse(
        context.triggerPayload?.raw,
      )
      if (
        !eventKey ||
        !domainEventId ||
        !parsed.success ||
        context.triggerPayload?.source !== 'skillify-native' ||
        context.triggerPayload?.event !== 'job.completed'
      ) {
        throw new Error('Job Completion Message is missing its occurrence identity.')
      }
      const occurrence = parsed.data
      if (occurrence.workspaceId !== workspaceId) {
        throw new Error('Job Completion Message workspace does not match.')
      }

      const managedAutomation = await prisma.automation.findFirst({
        where: {
          id: automationId,
          workspaceId,
          status: 'ACTIVE',
          simpleAutomationInstallation: {
            is: {
              definitionKey: 'job-completion-message',
              definitionVersion: 2,
              removedAt: null,
            },
          },
        },
        select: {
          id: true,
          simpleAutomationInstallation: { select: { id: true } },
        },
      })
      if (!managedAutomation) {
        throw new Error('Managed Simple Automation is no longer active.')
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true, ownerId: true, businessModel: true },
      })
      if (!workspace) throw new Error('Workspace not found for notification.')
      const plan = await getWorkspacePlan(workspaceId)
      if (
        workspace.businessModel !==
          WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS ||
        !getAutomationCapabilities(plan).canUseStarterAutomations
      ) {
        throw new Error('Managed Simple Automation is no longer eligible.')
      }

      const installationId = managedAutomation.simpleAutomationInstallation?.id
      if (!installationId) {
        throw new Error(
          'Managed Simple Automation dispatch is no longer current.',
        )
      }
      const currentDispatch = await prisma.simpleAutomationDispatch.findUnique({
        where: {
          installationId_eventKey: { installationId, eventKey },
        },
        select: { status: true, runId: true },
      })
      if (
        currentDispatch?.status !== 'PROCESSING' ||
        currentDispatch.runId !== runId
      ) {
        throw new Error(
          'Managed Simple Automation dispatch is no longer current.',
        )
      }

      const delivery = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Automation" WHERE "id" = ${automationId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const currentAutomation = await tx.automation.findFirst({
          where: {
            id: automationId,
            workspaceId,
            status: 'ACTIVE',
            simpleAutomationInstallation: {
              is: {
                definitionKey: 'job-completion-message',
                definitionVersion: 2,
                removedAt: null,
              },
            },
          },
          select: {
            simpleAutomationInstallation: { select: { id: true } },
          },
        })
        if (
          currentAutomation?.simpleAutomationInstallation?.id !== installationId
        ) {
          throw new Error('Managed Simple Automation is no longer active.')
        }
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SimpleAutomationDispatch" WHERE "installationId" = ${installationId} AND "eventKey" = ${eventKey} FOR UPDATE`,
        )
        const lockedDispatch = await tx.simpleAutomationDispatch.findUnique({
          where: {
            installationId_eventKey: { installationId, eventKey },
          },
          select: { status: true, runId: true },
        })
        if (
          lockedDispatch?.status !== 'PROCESSING' ||
          lockedDispatch.runId !== runId
        ) {
          throw new Error(
            'Managed Simple Automation dispatch is no longer current.',
          )
        }
        const lockedJob = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Job" WHERE "id" = ${occurrence.jobId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        if (lockedJob.length !== 1) {
          throw new Error('Managed Job completion is no longer current.')
        }
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "DomainOutboxEvent" WHERE "id" = ${domainEventId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        const currentOccurrence = await tx.domainOutboxEvent.findFirst({
          where: {
            id: domainEventId,
            workspaceId,
            topic: 'job.completed',
            aggregateType: 'Job',
            aggregateId: occurrence.jobId,
            status: 'PROCESSING',
            NOT: { processingOutcome: 'SUPERSEDED_BY_RECOMPLETION' },
          },
          select: { id: true, payload: true },
        })
        const persistedOccurrence = nativeJobCompletedPayloadSchema.safeParse(
          currentOccurrence?.payload,
        )
        if (
          !persistedOccurrence.success ||
          persistedOccurrence.data.workspaceId !== workspaceId ||
          persistedOccurrence.data.jobId !== occurrence.jobId ||
          persistedOccurrence.data.completionRevision !==
            occurrence.completionRevision ||
          persistedOccurrence.data.completedAt !== occurrence.completedAt
        ) {
          throw new Error('Managed Job completion is no longer current.')
        }
        const job = await tx.job.findFirst({
          where: { id: occurrence.jobId, workspaceId },
          select: {
            status: true,
            completedAt: true,
            assigneeMemberId: true,
            assignee: { select: { userId: true, workspaceId: true } },
          },
        })
        const completedAt = new Date(occurrence.completedAt)
        if (
          !job ||
          job.status !== 'COMPLETED' ||
          job.completedAt?.getTime() !== completedAt.getTime()
        ) {
          throw new Error('Managed Job completion is no longer current.')
        }

        const useAssignee = data?.recipient === 'job-assignee-or-owner'
        const validAssignee =
          useAssignee &&
          job.assigneeMemberId &&
          job.assignee?.workspaceId === workspaceId
            ? job.assignee
            : null
        const recipientUserId = validAssignee?.userId ?? workspace.ownerId
        const recipientWorkspaceMemberId = validAssignee
          ? job.assigneeMemberId
          : null
        const finalPlan = await getWorkspacePlan(workspaceId)
        if (!getAutomationCapabilities(finalPlan).canUseStarterAutomations) {
          throw new Error('Managed Simple Automation is no longer eligible.')
        }
        const deduplicationKey = `simple:job-completion:${eventKey}`
        const contextLabel = occurrence.customerDisplayName
          ? `${occurrence.title} for ${occurrence.customerDisplayName}`
          : occurrence.title
        const notification = await tx.schedulingNotification.upsert({
          where: {
            workspaceId_deduplicationKey: {
              workspaceId,
              deduplicationKey,
            },
          },
          create: {
            workspaceId,
            key: 'simple.job-completion',
            deduplicationKey,
            category: 'EVENT_UPDATED',
            priority: 'NORMAL',
            recipientType: validAssignee ? 'workspaceMember' : 'workspaceOwner',
            recipientUserId,
            recipientWorkspaceMemberId,
            title: 'Job completed',
            body: `Job completed: ${contextLabel}`,
            deepLink: `/dashboard/${workspace.slug}/jobs`,
            entityType: 'Job',
            entityId: occurrence.jobId,
            relatedRecordType: 'job',
            relatedRecordId: occurrence.jobId,
            metadata: {
              automationId,
              definitionKey: data.definitionKey,
              source: 'skillify-native',
              domainEventId,
              completionRevision: occurrence.completionRevision,
              completedAt: occurrence.completedAt,
              customerId: occurrence.customerId,
            },
          },
          update: {},
          select: { id: true },
        })
        return { notification, usedAssignee: Boolean(validAssignee) }
      })

      return {
        output: { notificationId: delivery.notification.id, delivered: true },
        log: delivery.usedAssignee
          ? 'In-app Job completion notification created for the current assignee.'
          : 'In-app Job completion notification created for the workspace owner.',
      }
    }

    case 'crm-action': {
      const runState = context.runState ?? { crmActionCount: 0 }
      runState.crmActionCount += 1
      if (runState.crmActionCount > 10) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_RATE_LIMITED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider: data?.provider,
            action: data?.action,
            objectType: data?.objectType,
            count: runState.crmActionCount,
            integrationId: data?.integrationId,
            automationId: context.automationId,
            failureCategory: classifyCRMError('rate limit'),
          }),
        })
        return {
          output: { error: 'CRM action rate-limited' },
          log: 'CRM action skipped due to per-run rate limit.',
        }
      }

      const provider = (data?.provider ?? '') as IntegrationProvider
      const adapter = getIntegrationAdapter(provider)
      if (!adapter) {
        return {
          output: {},
          log: `CRM adapter not found for ${provider}`,
        }
      }

      const integrationId = data?.integrationId as string | undefined
      const integration = integrationId
        ? await prisma.integration.findFirst({
            where: {
              id: integrationId,
              workspaceId: context.workspaceId,
              provider,
            },
            include: { credentials: true },
          })
        : null

      if (integrationId && !integration) {
        return {
          output: { error: 'Integration unavailable in this workspace' },
          log: 'CRM action skipped: integration unavailable in this workspace.',
        }
      }

      // Kill switches: disable actions or all CRM
      if (
        process.env.CRM_DISABLE_ALL === 'true' ||
        process.env.CRM_DISABLE_ACTIONS === 'true'
      ) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: {
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            reason: 'CRM actions disabled',
          },
        })
        return {
          output: { error: 'CRM actions disabled' },
          log: 'CRM actions disabled via env flag.',
        }
      }

      const credential = integration?.credentials?.[0]
      const ctx = {
        workspaceId: context.workspaceId!,
        integrationId: integrationId ?? '',
        provider,
        credentials:
          credential && credential.accessToken
            ? {
                accessToken: decryptToken(credential.accessToken),
                refreshToken: credential.refreshToken
                  ? decryptToken(credential.refreshToken)
                  : undefined,
                expiresAt: credential.expiresAt ?? undefined,
              }
            : undefined,
      }

      const plan = await getWorkspacePlan(context.workspaceId!)
      const allowed = plan === 'Elite' || plan === 'Pro'
      if (!allowed) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: {
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            reason: 'Plan insufficient',
          },
        })
        return {
          output: { error: 'Plan insufficient for CRM action (requires Pro)' },
          log: 'CRM action skipped: plan insufficient (requires Pro).',
        }
      }

      // Circuit breaker check/reset
      if (integrationId) {
        const breaker = await resetBreakerIfNeeded(integrationId)
        if (breaker.reset) {
          await logAudit({
            workspaceId: context.workspaceId!,
            action: 'CRM_CIRCUIT_RESET',
            targetType: 'Integration',
            targetId: integrationId,
            meta: normalizeCRMAuditMeta({ provider, integrationId }),
          })
        }
        if (await isBreakerOpen(integrationId)) {
          await logAudit({
            workspaceId: context.workspaceId!,
            action: 'CRM_ACTION_RATE_LIMITED',
            targetType: 'Integration',
            targetId: integrationId,
            meta: normalizeCRMAuditMeta({
              provider,
              action: data?.action,
              objectType: data?.objectType,
              integrationId,
              automationId: context.automationId,
              reason: 'Circuit open',
              failureCategory: classifyCRMError('Circuit open'),
            }),
          })
          return {
            output: { error: 'CRM circuit open' },
            log: 'CRM action skipped (circuit open).',
          }
        }

        const meta = (integration?.metadata as any) || {}
        if (meta.disabled) {
          await logAudit({
            workspaceId: context.workspaceId!,
            action: 'CRM_ACTION_FAILED',
            targetType: 'Integration',
            targetId: integrationId,
            meta: {
              provider,
              action: data?.action,
              objectType: data?.objectType,
              integrationId,
              automationId: context.automationId,
              reason: 'Integration disabled',
            },
          })
          return {
            output: { error: 'Integration disabled' },
            log: 'CRM action skipped (integration disabled).',
          }
        }
      }

      try {
        const timeoutMs = 8000
        const execPromise = adapter.executeAction(
          ctx,
          data?.action,
          data?.payload ?? {},
        )
        const defer = shouldDeferCRMAction({
          timeoutMs,
          expectedMs: (data?.payload as any)?.expectedMs,
        })
        const res = await Promise.race([
          execPromise,
          new Promise<IntegrationActionResult>((resolve) =>
            setTimeout(
              () => resolve({ ok: false, error: 'CRM_EXECUTION_TIMEOUT' }),
              timeoutMs,
            ),
          ),
        ])
        const externalId =
          data?.payload?.externalId ||
          (res.ok &&
            (res.data?.id || res.data?.objectId || res.data?.externalId))

        if (externalId) {
          await upsertExternalRecord({
            workspaceId: context.workspaceId!,
            provider,
            objectType: data?.objectType ?? 'contact',
            externalId: String(externalId),
            integrationId,
            localType: 'AutomationRun',
            localId: context.automationId ?? null,
          })
        }

        if (res.ok) {
          await logAudit({
            workspaceId: context.workspaceId!,
            actorId: context.userProfileId ?? undefined,
            action: 'CRM_ACTION_EXECUTED',
            targetType: 'Automation',
            targetId: context.automationId,
            meta: normalizeCRMAuditMeta({
              provider,
              action: data?.action,
              objectType: data?.objectType,
              integrationId,
              automationId: context.automationId,
              externalId: externalId ? String(externalId) : undefined,
              ...(defer
                ? buildDeferMeta({
                    reason: 'Expected long-running CRM action',
                    expectedMs: (data?.payload as any)?.expectedMs,
                  })
                : {}),
              failureCategory: 'unknown',
              failureSource: classifyFailureSource('crm-action'),
              ...(DEBUG_MODE
                ? {
                    debug: {
                      // Only include IDs/summary; never raw CRM payloads.
                      nodeType: 'crm-action',
                      action: data?.action,
                      objectType: data?.objectType,
                      integrationId,
                      automationId: context.automationId,
                    },
                  }
                : {}),
            }),
          })
          if (integrationId && integration) {
            await prisma.integration.update({
              where: { id: integrationId },
              data: {
                metadata: {
                  ...(integration.metadata as any),
                  lastSuccessfulActionAt: new Date().toISOString(),
                  lastError: null,
                },
              },
            })
          }
        } else {
          if (res.error === 'CRM_EXECUTION_TIMEOUT') {
            await logAudit({
              workspaceId: context.workspaceId!,
              actorId: context.userProfileId ?? undefined,
              action: 'CRM_EXECUTION_TIMEOUT',
              targetType: 'Automation',
              targetId: context.automationId,
              meta: normalizeCRMAuditMeta({
                provider,
                action: data?.action,
                objectType: data?.objectType,
                integrationId,
                automationId: context.automationId,
                timeoutMs,
                failureCategory: classifyCRMError(res.error),
                ...(defer
                  ? buildDeferMeta({
                      reason: 'Expected long-running CRM action',
                      expectedMs: (data?.payload as any)?.expectedMs,
                    })
                  : {}),
                failureSource: classifyFailureSource('crm-action'),
                ...(DEBUG_MODE
                  ? {
                      debug: {
                        nodeType: 'crm-action',
                        action: data?.action,
                        objectType: data?.objectType,
                        integrationId,
                        automationId: context.automationId,
                        hint: 'timeout',
                      },
                    }
                  : {}),
              }),
            })
          }
          await logAudit({
            workspaceId: context.workspaceId!,
            actorId: context.userProfileId ?? undefined,
            action: 'CRM_ACTION_FAILED',
            targetType: 'Automation',
            targetId: context.automationId,
            meta: normalizeCRMAuditMeta({
              provider,
              action: data?.action,
              objectType: data?.objectType,
              integrationId,
              automationId: context.automationId,
              error: res.error,
              failureCategory: classifyCRMError(res.error),
              ...(defer
                ? buildDeferMeta({
                    reason: 'Expected long-running CRM action',
                    expectedMs: (data?.payload as any)?.expectedMs,
                  })
                : {}),
              failureSource: classifyFailureSource('crm-action'),
              ...(DEBUG_MODE
                ? {
                    debug: {
                      nodeType: 'crm-action',
                      action: data?.action,
                      objectType: data?.objectType,
                      integrationId,
                      automationId: context.automationId,
                      hint: 'fail',
                    },
                  }
                : {}),
            }),
          })
          if (integrationId) {
            await recordFailure(
              integrationId,
              context.workspaceId!,
              provider,
              res.error,
            )
          }
        }

        return {
          output: res.ok ? (res.data ?? {}) : { error: res.error },
          log: res.ok
            ? `CRM action executed (${provider} • ${data?.action ?? 'unknown'})`
            : `CRM action failed: ${res.error ?? 'unknown error'}`,
        }
      } catch (err: any) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            error: err?.message ?? 'unknown error',
          }),
        })
        if (integrationId) {
          await recordFailure(
            integrationId,
            context.workspaceId!,
            provider,
            err?.message,
          )
        }

        return {
          output: { error: err?.message ?? 'CRM action failed' },
          log: `CRM action failed: ${err?.message ?? 'unknown error'}`,
        }
      }
    }

    case 'group':
      return {
        output: { grouped: true },
        log: 'Group node (visual only).',
      }

    default:
      throw new Error(`Unsupported automation node type: ${type ?? 'none'}`)
  }
}

/* ------------------------------ Standard Run Executor ------------------------------ */

export async function runAutomation(
  automationId: string,
  {
    triggerPayload,
    userProfileId,
    expectedWorkspaceId,
    onRunCreated,
  }: RunOptions,
) {
  const automation = await prisma.automation.findFirst({
    where: {
      id: automationId,
      workspaceId: expectedWorkspaceId ?? undefined,
    },
    include: { workspace: true },
  })

  if (!automation) throw new Error('Automation not found')
  const preconditionError = getAutomationExecutionPreconditionError({
    status: automation.status,
    workspaceId: automation.workspaceId,
    expectedWorkspaceId,
  })
  if (preconditionError) throw new Error(preconditionError)

  const safeAutomation = automation

  const rawFlow = safeAutomation.flow as any as FlowGraph | null
  if (!rawFlow || !rawFlow.nodes?.length) {
    throw new Error('Automation has no flow')
  }

  const flow: FlowGraph = rawFlow

  const run = await prisma.automationRun.create({
    data: {
      automationId: safeAutomation.id,
      workspaceId: safeAutomation.workspaceId,
      status: 'RUNNING',
      log: '',
      userProfileId: userProfileId ?? null,
    },
  })

  if (onRunCreated) {
    try {
      await onRunCreated(run.id)
    } catch (error) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          log: 'Dispatch binding failed before node execution.',
        },
      })
      throw error
    }
  }

  const logLines: string[] = []
  const visited = new Set<string>()
  const runState = { crmActionCount: 0 }
  let executedNodes = 0
  const MAX_NODES = 200
  const MAX_DEPTH = 12

  async function processNode(nodeId: string, depth: number): Promise<void> {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    if (depth > MAX_DEPTH) {
      // Guard: stop deep recursion to avoid runaway execution
      await logAudit({
        workspaceId: safeAutomation.workspaceId,
        action: 'AUTOMATION_GUARD_DEPTH',
        targetType: 'Automation',
        targetId: safeAutomation.id,
        meta: { depth, reason: 'Max depth reached' },
      })
      return
    }
    executedNodes += 1
    if (executedNodes > MAX_NODES) {
      // Guard: stop if too many nodes executed in a single run
      await logAudit({
        workspaceId: safeAutomation.workspaceId,
        action: 'AUTOMATION_GUARD_NODES',
        targetType: 'Automation',
        targetId: safeAutomation.id,
        meta: { executedNodes, reason: 'Max nodes reached' },
      })
      return
    }

    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const context: NodeExecutionContext = {
      triggerPayload,
      depth,
      workspaceId: safeAutomation.workspaceId,
      automationId: safeAutomation.id,
      userProfileId: userProfileId ?? null,
      runState,
      runId: run.id,
    }
    const runEvent = await prisma.automationRunEvent.create({
      data: {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type ?? 'unknown',
        status: 'RUNNING',
        message: 'Node execution started.',
        path: null,
      },
    })

    try {
      const result = await executeNode(node.type, node.data, context)
      logLines.push(`[${node.type ?? 'node'}:${node.id}] ${result.log}`)
      await prisma.automationRunEvent.update({
        where: { id: runEvent.id },
        data: {
          status: 'SUCCESS',
          message: result.log,
          path: result.output?.path ?? null,
        },
      })
    } catch (error) {
      await prisma.automationRunEvent.update({
        where: { id: runEvent.id },
        data: {
          status: 'FAILED',
          message:
            error instanceof Error ? error.message : 'Node execution failed.',
        },
      })
      throw error
    }

    const next = nextNodes(flow, node.id)
    for (const n of next) await processNode(n.id, depth + 1)
  }

  try {
    const roots = findStartNodes(flow)
    if (!roots.length) logLines.push('⚠ No root nodes found.')

    for (const root of roots) await processNode(root.id, 0)

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        log: logLines.join('\n'),
      },
    })

    return run.id
  } catch (err: any) {
    logLines.push(`ERROR: ${err?.message}`)

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        log: logLines.join('\n'),
      },
    })

    throw err
  }
}

/* ------------------------------ LIVE STREAMING EXECUTOR (SSE) ------------------------------ */

export async function executeAutomationLive(
  _prismaClient: any,
  runId: string,
  flow: FlowGraph,
  emit: (evt: any) => Promise<void>,
  context: {
    workspaceId: string
    automationId: string
    userProfileId?: string | null
  },
) {
  const visited = new Set<string>()
  const logLines: string[] = []
  const runState = { crmActionCount: 0 }

  async function processNode(nodeId: string, depth: number) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const result = await executeNode(node.type, node.data, {
      depth,
      workspaceId: context.workspaceId,
      automationId: context.automationId,
      userProfileId: context.userProfileId ?? null,
      runState,
    })

    const evt = {
      kind: 'nodeEnd',
      runId,
      nodeId: node.id,
      nodeType: node.type ?? 'unknown',
      status: 'SUCCESS',
      message: result.log,
      path: result.output?.path ?? null,
    }

    logLines.push(`[${node.type}:${node.id}] ${result.log}`)

    await emit(evt)

    const outgoing = nextNodes(flow, node.id)
    for (const n of outgoing) await processNode(n.id, depth + 1)
  }

  try {
    const roots = findStartNodes(flow)
    if (!roots.length) logLines.push('⚠ No root nodes found.')

    for (const r of roots) await processNode(r.id, 0)

    return { success: true, log: logLines.join('\n') }
  } catch (err: any) {
    logLines.push('ERROR: ' + (err.message ?? 'unknown'))
    return { success: false, log: logLines.join('\n') }
  }
}
