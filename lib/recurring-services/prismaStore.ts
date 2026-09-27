import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { RecurringServiceServiceError } from '@/lib/recurring-services/service'
import type { RecurringServiceStore } from '@/lib/recurring-services/service'

const recurringServiceInclude = {
  stepTemplates: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  customer: {
    select: { id: true, displayName: true },
  },
  recurrenceSeries: {
    select: {
      id: true,
      status: true,
      version: true,
      timezone: true,
      normalizedRule: true,
      localStartDate: true,
      localStartTime: true,
      durationMinutes: true,
      masterEvent: {
        select: {
          id: true,
          title: true,
          startsAtUtc: true,
          endsAtUtc: true,
          assignments: {
            select: {
              id: true,
              assignmentType: true,
              workspaceMemberId: true,
              teamId: true,
              roleLabel: true,
              displaySnapshot: true,
            },
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
    },
  },
  jobs: {
    where: { archivedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      completedAt: true,
      valueCents: true,
      currency: true,
      assignments: {
        select: {
          id: true,
          assignmentType: true,
          workspaceMemberId: true,
          teamId: true,
          roleLabel: true,
          displaySnapshot: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: [{ scheduledStartAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.RecurringServiceInclude

function seriesConflict() {
  return new RecurringServiceServiceError(
    'This recurring schedule already belongs to a Recurring Service.',
    409,
    'CONFLICT',
    {
      recurrenceSeriesId: [
        'Choose a recurring schedule that is not already in use.',
      ],
    },
  )
}

export const prismaRecurringServiceStore: RecurringServiceStore = {
  async getWorkspaceBusinessModel(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    })
    return workspace?.businessModel ?? null
  },

  findActiveCustomer({ workspaceId, customerId }) {
    return prisma.customer.findFirst({
      where: { id: customerId, workspaceId, archivedAt: null },
      select: { id: true },
    })
  },

  async findRecurrenceSeries({ workspaceId, recurrenceSeriesId }) {
    const series = await prisma.schedulingRecurrenceSeries.findFirst({
      where: { id: recurrenceSeriesId, workspaceId },
      select: {
        id: true,
        status: true,
        masterEvent: { select: { eventTypeKey: true } },
      },
    })
    return series
      ? {
          id: series.id,
          status: series.status,
          eventTypeKey: series.masterEvent.eventTypeKey,
        }
      : null
  },

  findByRecurrenceSeries({ workspaceId, recurrenceSeriesId }) {
    return prisma.recurringService.findFirst({
      where: { workspaceId, recurrenceSeriesId },
      include: recurringServiceInclude,
    })
  },

  async createRecurringService(data) {
    try {
      return await prisma.$transaction(async (tx) => {
        const customers = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Customer" WHERE "id" = ${data.customerId} AND "workspaceId" = ${data.workspaceId} AND "archivedAt" IS NULL FOR UPDATE`,
        )
        if (customers.length !== 1) {
          throw new RecurringServiceServiceError(
            'Choose an active Customer from this workspace.',
            400,
            'VALIDATION_ERROR',
            {
              customerId: ['Choose an active Customer from this workspace.'],
            },
          )
        }
        const series = await tx.$queryRaw<
          Array<{ id: string; status: string; eventTypeKey: string }>
        >(
          Prisma.sql`
            SELECT series."id", series."status"::text, master."eventTypeKey"
            FROM "SchedulingRecurrenceSeries" AS series
            INNER JOIN "SchedulingEvent" AS master
              ON master."id" = series."masterEventId"
            WHERE series."id" = ${data.recurrenceSeriesId}
              AND series."workspaceId" = ${data.workspaceId}
            FOR UPDATE OF series
          `,
        )
        const linkedSeries = series[0]
        if (
          !linkedSeries ||
          linkedSeries.eventTypeKey !== 'recurringServiceVisit'
        ) {
          throw new RecurringServiceServiceError(
            'Choose a recurring service schedule from this workspace.',
            400,
            'VALIDATION_ERROR',
            {
              recurrenceSeriesId: [
                'Choose a recurring service schedule from this workspace.',
              ],
            },
          )
        }
        if (
          linkedSeries.status !== 'ACTIVE' &&
          linkedSeries.status !== 'PAUSED'
        ) {
          throw new RecurringServiceServiceError(
            'An ended Scheduling series cannot back a new Recurring Service.',
            409,
            'CONFLICT',
          )
        }
        const existing = await tx.recurringService.findFirst({
          where: {
            workspaceId: data.workspaceId,
            recurrenceSeriesId: data.recurrenceSeriesId,
          },
          select: { id: true },
        })
        if (existing) throw seriesConflict()

        const recurringService = await tx.recurringService.create({
          data: {
            workspaceId: data.workspaceId,
            customerId: data.customerId,
            recurrenceSeriesId: data.recurrenceSeriesId,
            name: data.name,
            description: data.description,
            serviceInstructions: data.serviceInstructions,
            pricePerVisitCents: data.pricePerVisitCents,
            currency: data.currency,
            defaultJobPriority: data.defaultJobPriority,
            status: linkedSeries.status,
            createdByUserId: data.createdByUserId,
            stepTemplates: {
              create: data.stepTemplates.map((step) => ({
                workspaceId: data.workspaceId,
                ...step,
              })),
            },
          },
          include: recurringServiceInclude,
        })
        await tx.domainOutboxEvent.create({
          data: {
            workspaceId: data.workspaceId,
            topic: 'scheduling.recurrence.materialized',
            aggregateType: 'SchedulingRecurrenceSeries',
            aggregateId: data.recurrenceSeriesId,
            deduplicationKey: `recurring-service:reconcile:${recurringService.id}`,
            payload: {
              seriesId: data.recurrenceSeriesId,
              recurringServiceId: recurringService.id,
              recurringServiceReconciliation: true,
            },
          },
        })
        return recurringService
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw seriesConflict()
      }
      throw error
    }
  },

  findRecurringService({ workspaceId, recurringServiceId }) {
    return prisma.recurringService.findFirst({
      where: { id: recurringServiceId, workspaceId },
      include: recurringServiceInclude,
    })
  },

  listRecurringServices(workspaceId) {
    return prisma.recurringService.findMany({
      where: { workspaceId },
      include: recurringServiceInclude,
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    })
  },

  updateRecurringService({ workspaceId, recurringServiceId, data }) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "RecurringService" WHERE "id" = ${recurringServiceId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      if (locked.length !== 1) return null

      const { stepTemplates, ...serviceData } = data
      if (Object.keys(serviceData).length > 0) {
        await tx.recurringService.update({
          where: { id: recurringServiceId },
          data: serviceData,
        })
      }
      if (stepTemplates !== undefined) {
        await tx.recurringServiceStepTemplate.deleteMany({
          where: { recurringServiceId, workspaceId },
        })
        if (stepTemplates.length > 0) {
          await tx.recurringServiceStepTemplate.createMany({
            data: stepTemplates.map((step) => ({
              workspaceId,
              recurringServiceId,
              ...step,
            })),
          })
        }
      }
      return tx.recurringService.findFirst({
        where: { id: recurringServiceId, workspaceId },
        include: recurringServiceInclude,
      })
    })
  },
}
