import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

import { prisma } from '@/lib/db'
import {
  createNativeLeadCreatedPayload,
  createNativeLeadFollowUpDuePayload,
  NATIVE_LEAD_AGGREGATE_TYPE,
  NATIVE_LEAD_CREATED_TOPIC,
  NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC,
} from '@/lib/domain-events/nativeLeadEvents'
import {
  customerDisplayNameFromLead,
  normalizeLeadDuplicateEmail,
  normalizeLeadDuplicatePhone,
} from '@/lib/leads/conversion'
import type { LeadsStore } from '@/lib/leads/service'
import { LeadStage, WorkspaceBusinessModel } from '@/lib/prisma/enums'

const leadWithConversion = {
  convertedCustomer: {
    select: {
      id: true,
      displayName: true,
      companyName: true,
      email: true,
      phone: true,
      archivedAt: true,
    },
  },
} as const

async function createFollowUpEventWhenActive(
  tx: Prisma.TransactionClient,
  lead: {
    id: string
    workspaceId: string
    followUpAt: Date | null
    updatedAt: Date
    stage: LeadStage
    convertedCustomerId: string | null
    archivedAt: Date | null
  },
) {
  if (
    !lead.followUpAt ||
    lead.stage === LeadStage.WON ||
    lead.stage === LeadStage.LOST ||
    lead.convertedCustomerId ||
    lead.archivedAt
  ) {
    return null
  }
  const activeInstallation = await tx.simpleAutomationInstallation.findFirst({
    where: {
      workspaceId: lead.workspaceId,
      definitionKey: 'lead-follow-up',
      removedAt: null,
      automation: { status: 'ACTIVE' },
    },
    select: { id: true },
  })
  if (!activeInstallation) return null

  const scheduleRevision = randomUUID()
  const event = await tx.domainOutboxEvent.create({
    data: {
      workspaceId: lead.workspaceId,
      topic: NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC,
      aggregateType: NATIVE_LEAD_AGGREGATE_TYPE,
      aggregateId: lead.id,
      deduplicationKey: `native:lead.follow-up:${lead.workspaceId}:${lead.id}:${scheduleRevision}`,
      payload: createNativeLeadFollowUpDuePayload({
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        followUpAt: lead.followUpAt,
        scheduleRevision,
        occurredAt: lead.updatedAt,
      }),
      status: 'PENDING',
      availableAt: lead.followUpAt,
      nextAttemptAt: lead.followUpAt,
    },
    select: { id: true },
  })
  return event.id
}

export const prismaLeadsStore: LeadsStore = {
  async getWorkspaceBusinessModel(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    })
    return workspace?.businessModel ?? null
  },

  async isWorkspaceMember({ workspaceId, memberId }) {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true },
    })
    return Boolean(member)
  },

  createLead(data) {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data,
        include: leadWithConversion,
      })
      const event = await tx.domainOutboxEvent.create({
        data: {
          workspaceId: lead.workspaceId,
          topic: NATIVE_LEAD_CREATED_TOPIC,
          aggregateType: NATIVE_LEAD_AGGREGATE_TYPE,
          aggregateId: lead.id,
          deduplicationKey: `native:lead.created:${lead.workspaceId}:${lead.id}`,
          payload: createNativeLeadCreatedPayload({
            ...lead,
            leadId: lead.id,
          }),
          status: 'PENDING',
          nextAttemptAt: lead.createdAt,
          availableAt: lead.createdAt,
        },
        select: { id: true },
      })
      const followUpEventId = await createFollowUpEventWhenActive(tx, lead)
      return { lead, eventId: event.id, followUpEventId }
    })
  },

  findLead({ workspaceId, leadId }) {
    return prisma.lead.findFirst({
      where: { id: leadId, workspaceId, archivedAt: null },
      include: leadWithConversion,
    })
  },

  listLeads({ workspaceId, search, stage }) {
    return prisma.lead.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        stage,
        ...(search
          ? {
              OR: [
                { displayName: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { nextStep: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: leadWithConversion,
      orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    })
  },

  updateLead({ workspaceId, leadId, expectedStage, data }) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Lead" WHERE "id" = ${leadId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      if (locked.length !== 1) return null
      const existing = await tx.lead.findFirst({
        where: { id: leadId, workspaceId, archivedAt: null },
        select: { stage: true, followUpAt: true },
      })
      if (!existing || (expectedStage && existing.stage !== expectedStage)) {
        return null
      }
      const result = await tx.lead.updateMany({
        where: {
          id: leadId,
          workspaceId,
          archivedAt: null,
          stage: expectedStage,
          ...(data.stage !== undefined && data.stage !== LeadStage.WON
            ? { convertedCustomerId: null }
            : {}),
        },
        data,
      })
      if (result.count !== 1) return null
      const lead = await tx.lead.findFirst({
        where: { id: leadId, workspaceId },
        include: leadWithConversion,
      })
      if (!lead) return null
      const followUpChanged =
        data.followUpAt !== undefined &&
        existing.followUpAt?.getTime() !== data.followUpAt?.getTime()
      const followUpEventId = followUpChanged
        ? await createFollowUpEventWhenActive(tx, lead)
        : null
      return { lead, followUpEventId }
    })
  },

  archiveLead({ workspaceId, leadId, archivedAt }) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.lead.updateMany({
        where: { id: leadId, workspaceId, archivedAt: null },
        data: { archivedAt },
      })
      if (result.count !== 1) return null
      return tx.lead.findFirst({
        where: { id: leadId, workspaceId },
        include: leadWithConversion,
      })
    })
  },

  convertLead(input) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { businessModel: true },
      })
      if (
        workspace?.businessModel !==
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
      ) {
        return { status: 'UNAVAILABLE' as const }
      }

      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Lead" WHERE "id" = ${input.leadId} AND "workspaceId" = ${input.workspaceId} FOR UPDATE`,
      )
      if (locked.length !== 1) return { status: 'NOT_FOUND' as const }

      const lead = await tx.lead.findFirst({
        where: { id: input.leadId, workspaceId: input.workspaceId },
        include: leadWithConversion,
      })
      if (!lead) return { status: 'NOT_FOUND' as const }
      if (lead.convertedCustomerId && lead.convertedCustomer) {
        return {
          status: 'ALREADY_CONVERTED' as const,
          lead,
          customer: lead.convertedCustomer,
        }
      }
      if (lead.archivedAt) return { status: 'NOT_FOUND' as const }

      const normalizedEmail = normalizeLeadDuplicateEmail(lead.email)
      const normalizedPhone = normalizeLeadDuplicatePhone(lead.phone)
      const possibleCustomers =
        normalizedEmail || normalizedPhone
          ? await tx.customer.findMany({
              where: { workspaceId: input.workspaceId },
              select: {
                id: true,
                displayName: true,
                companyName: true,
                email: true,
                phone: true,
                archivedAt: true,
              },
              orderBy: [{ archivedAt: 'asc' }, { displayName: 'asc' }],
            })
          : []
      const candidates = possibleCustomers.filter(
        (customer) =>
          (normalizedEmail !== null &&
            normalizeLeadDuplicateEmail(customer.email) === normalizedEmail) ||
          (normalizedPhone !== null &&
            normalizeLeadDuplicatePhone(customer.phone) === normalizedPhone),
      )
      if (candidates.length && !input.confirmDuplicate) {
        return {
          status: 'DUPLICATE_WARNING' as const,
          lead,
          candidates,
        }
      }

      const customer = await tx.customer.create({
        data: {
          workspaceId: input.workspaceId,
          displayName: customerDisplayNameFromLead(lead),
          companyName: lead.companyName,
          contactName: lead.displayName,
          email: lead.email,
          phone: lead.phone,
          serviceAddressLine1: null,
          serviceAddressLine2: null,
          serviceAddressCity: null,
          serviceAddressRegion: null,
          serviceAddressPostalCode: null,
          serviceAddressCountry: null,
          notes: lead.notes,
          assignedMemberId: lead.assignedMemberId,
          createdByUserId: input.converterUserProfileId,
        },
        select: {
          id: true,
          displayName: true,
          companyName: true,
          email: true,
          phone: true,
          archivedAt: true,
        },
      })
      const convertedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stage: LeadStage.WON,
          convertedCustomerId: customer.id,
          convertedAt: input.convertedAt,
        },
        include: leadWithConversion,
      })
      return { status: 'SUCCESS' as const, lead: convertedLead, customer }
    })
  },
}
