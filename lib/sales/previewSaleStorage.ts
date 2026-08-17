import type { WorkspaceClient } from '@/lib/clients/types'
import {
  readPreviewClients,
  upsertPreviewClient,
} from '@/lib/clients/previewClientStorage'
import {
  getSaleStatusForStage,
  normalizeSaleStage,
} from '@/lib/crm/pipelineStageRegistry'
import { resolveContactIdentity } from '@/lib/crm/contactIdentity'
import { getLocalTimestamp } from '@/lib/formatting/dates'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'
import {
  createWorkspaceActivityRecord,
  type WorkspaceActivityRecord,
} from '@/lib/workspace-records/activity'

const STORAGE_PREFIX = 'skillify-preview-sales'

export type SaleStage =
  | 'New'
  | 'New Lead'
  | 'Qualified'
  | 'Discovery Scheduled'
  | 'Proposal Sent'
  | 'Quote Preparation'
  | 'Quote Sent'
  | 'Negotiation'
  | 'Accepted'
  | 'Payment Pending'
  | 'Onboarding'
  | 'Completed'
  | 'Closed-Won'
  | 'Closed-Lost'
  | 'Won'
  | 'Lost'

export type SaleStatus = 'Active' | 'At Risk' | 'Closed-Won' | 'Closed-Lost'

export type SaleRecord = {
  id: string
  name: string
  contactName: string
  contactEmail?: string
  contactPhone?: string
  sharedContactId?: string
  company: string
  clientId?: string
  sourceLeadId?: string
  sourceOpportunityId?: string
  saleNotes?: string
  notes?: string
  status: SaleStatus
  stage: SaleStage
  value: number
  probability: number
  ownerId: string
  nextStep: string
  createdAt: string
  convertedAt?: string
  lastActivityAt: string
}

export const terminalWonSaleStages: SaleStage[] = ['Closed-Won']

export function getPreviewSaleStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function readPreviewSales(workspaceId: string): SaleRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewSaleStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as SaleRecord[]) : []
  } catch {
    return []
  }
}

export function writePreviewSales(workspaceId: string, sales: SaleRecord[]) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewSaleStorageKey(workspaceId),
    JSON.stringify(sales),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'sales')
}

export function upsertPreviewSale(workspaceId: string, sale: SaleRecord) {
  const currentSales = readPreviewSales(workspaceId).filter(
    (record) =>
      record.id !== sale.id &&
      (!sale.sourceLeadId || record.sourceLeadId !== sale.sourceLeadId) &&
      (!sale.sourceOpportunityId ||
        record.sourceOpportunityId !== sale.sourceOpportunityId),
  )
  const nextSales = [sale, ...currentSales]
  writePreviewSales(workspaceId, nextSales)
  return nextSales
}

export function normalizeSaleRecord(
  input: Omit<Partial<SaleRecord>, 'status' | 'stage'> & {
    id: string
    name: string
    company: string
    value: number
    ownerId: string
    status?: string
    stage?: string
  },
) {
  const timestamp = input.convertedAt ?? input.createdAt ?? getLocalTimestamp()
  const stage = normalizeSaleStage(input.stage, input.status)
  const status = input.status
    ? getSaleStatusForStage(stage, input.status as SaleStatus)
    : getSaleStatusForStage(stage)

  return {
    ...input,
    contactName: input.contactName ?? input.company,
    status,
    stage,
    probability:
      input.probability ??
      (status === 'Closed-Won' ? 100 : status === 'Closed-Lost' ? 0 : 70),
    nextStep: input.nextStep ?? 'Prepare quote',
    createdAt: timestamp,
    convertedAt: input.convertedAt ?? timestamp,
    lastActivityAt: input.lastActivityAt ?? timestamp,
  } as SaleRecord
}

function clientIdForSale(sale: SaleRecord) {
  return `client-from-sale-${sale.id}`
}

function createClientFromSale(
  workspaceId: string,
  sale: SaleRecord,
  timestamp: string,
): WorkspaceClient {
  const identity = resolveContactIdentity(workspaceId, sale)
  return {
    id: sale.clientId ?? clientIdForSale(sale),
    workspaceId,
    sharedContactId: identity.id,
    sourceLeadId: sale.sourceLeadId,
    sourceOpportunityId: sale.sourceOpportunityId,
    sourceSaleId: sale.id,
    name: identity.contactName,
    company: identity.companyName ?? sale.company,
    email: identity.email ?? sale.contactEmail ?? '',
    phone: identity.phone ?? sale.contactPhone ?? '',
    status: 'Active',
    pipelineStage: sale.stage === 'Completed' ? 'Completed' : 'Onboarding',
    lastActivity: timestamp,
    openTasks: sale.stage === 'Completed' ? 0 : 1,
    value: sale.value,
    nextAction:
      sale.stage === 'Completed'
        ? 'Review completed work'
        : 'Start client onboarding',
    ownerId: sale.ownerId,
    health: 'Healthy',
    tags: ['High Value'],
    internalNotes: `Created from sale: ${sale.name}.`,
    notes: `Created from sale: ${sale.name}.`,
    activity: [],
    tasks:
      sale.stage === 'Completed'
        ? ['Confirm completion notes']
        : ['Send onboarding documents'],
    suggestedAutomations: ['Client onboarding', 'Review request follow-up'],
    opportunity: {
      value: sale.value,
      nextAction: 'Start client onboarding',
      probability: 100,
      expectedCloseWindow: sale.stage,
    },
  }
}

export function moveSaleStage(
  workspaceId: string,
  sale: SaleRecord,
  stage: SaleStage,
): {
  sale: SaleRecord
  client?: WorkspaceClient
  events: WorkspaceActivityRecord[]
} {
  const timestamp = getLocalTimestamp()
  const normalizedStage = normalizeSaleStage(stage, sale.status)
  const nextStatus = getSaleStatusForStage(normalizedStage)
  const clientId =
    nextStatus === 'Closed-Won'
      ? (sale.clientId ?? clientIdForSale(sale))
      : sale.clientId
  const nextSale: SaleRecord = {
    ...sale,
    stage: normalizedStage,
    status: nextStatus,
    probability:
      nextStatus === 'Closed-Won'
        ? 100
        : nextStatus === 'Closed-Lost'
          ? 0
          : sale.probability,
    clientId,
    nextStep:
      nextStatus === 'Closed-Won'
        ? 'Client connected'
        : nextStatus === 'Closed-Lost'
          ? 'Archive sale'
          : sale.nextStep,
    lastActivityAt: timestamp,
  }
  const events: WorkspaceActivityRecord[] = [
    createWorkspaceActivityRecord({
      id: `lifecycle-sale-stage-${sale.id}-${normalizedStage}`,
      workspaceId,
      recordId: sale.id,
      recordType: 'sale',
      action: 'statusChanged',
      title: 'Sale stage changed',
      description: `${sale.name} moved to ${normalizedStage}.`,
      timestamp,
      metadata: {
        saleId: sale.id,
        previousStage: sale.stage,
        nextStage: normalizedStage,
        previousStatus: sale.status,
        nextStatus,
        clientId: clientId ?? null,
      },
    }),
  ]

  if (nextStatus !== 'Closed-Won') {
    return { sale: nextSale, events }
  }

  const existingClient =
    readPreviewClients(workspaceId).find(
      (client) => client.id === clientId || client.company === sale.company,
    ) ?? null
  const client =
    existingClient ?? createClientFromSale(workspaceId, nextSale, timestamp)
  const connectedSale = { ...nextSale, clientId: client.id }

  upsertPreviewClient(workspaceId, client)
  events.push(
    createWorkspaceActivityRecord({
      id: existingClient
        ? `lifecycle-sale-client-connected-${sale.id}`
        : `lifecycle-sale-client-created-${sale.id}`,
      workspaceId,
      recordId: sale.id,
      recordType: 'sale',
      action: existingClient ? 'updated' : 'created',
      title: existingClient
        ? 'Sale connected to existing Client'
        : 'Sale marked Closed-Won and Client created',
      description: existingClient
        ? `${sale.name} was connected to ${client.company}.`
        : `${sale.name} created ${client.company} as a Client.`,
      timestamp,
      metadata: {
        saleId: sale.id,
        clientId: client.id,
        companyName: client.company,
        contactName: sale.contactName,
      },
    }),
  )

  return { sale: connectedSale, client, events }
}
