import type {
  OperationsPriority,
  RecurringServiceStatus,
} from '@/lib/prisma/enums'

export type RecurringServiceStepTemplateRecord = {
  id: string
  workspaceId: string
  recurringServiceId: string
  title: string
  description: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type RecurringServiceRecord = {
  id: string
  workspaceId: string
  customerId: string
  recurrenceSeriesId: string
  name: string
  description: string | null
  serviceInstructions: string | null
  pricePerVisitCents: number
  currency: string
  defaultJobPriority: OperationsPriority
  status: RecurringServiceStatus
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  endedAt: Date | null
  stepTemplates: RecurringServiceStepTemplateRecord[]
  customer?: {
    id: string
    displayName: string
  }
  recurrenceSeries?: {
    id: string
    status: string
    version: number
    timezone: string
    normalizedRule: unknown
    localStartDate: string | null
    localStartTime: string | null
    durationMinutes: number
    masterEvent: {
      id: string
      title: string
      startsAtUtc: Date
      endsAtUtc: Date
      assignments: Array<{
        id: string
        assignmentType: 'MEMBER' | 'TEAM'
        workspaceMemberId: string | null
        teamId: string | null
        roleLabel: string | null
        displaySnapshot: string | null
      }>
    }
  }
  jobs?: Array<{
    id: string
    title: string
    status: string
    priority: string
    scheduledStartAt: Date | null
    scheduledEndAt: Date | null
    completedAt: Date | null
    valueCents: number | null
    currency: string
    assignments: Array<{
      id: string
      assignmentType: 'MEMBER' | 'TEAM'
      workspaceMemberId: string | null
      teamId: string | null
      roleLabel: string | null
      displaySnapshot: string | null
    }>
  }>
}

export type RecurringServiceStepTemplateInput = {
  title: string
  description: string | null
  sortOrder: number
}

export type CreateRecurringServiceData = {
  workspaceId: string
  customerId: string
  recurrenceSeriesId: string
  name: string
  description: string | null
  serviceInstructions: string | null
  pricePerVisitCents: number
  currency: string
  defaultJobPriority: OperationsPriority
  status: Extract<RecurringServiceStatus, 'ACTIVE' | 'PAUSED'>
  createdByUserId: string
  stepTemplates: RecurringServiceStepTemplateInput[]
}

export type UpdateRecurringServiceData = Partial<
  Pick<
    RecurringServiceRecord,
    | 'name'
    | 'description'
    | 'serviceInstructions'
    | 'pricePerVisitCents'
    | 'currency'
    | 'defaultJobPriority'
  >
> & {
  stepTemplates?: RecurringServiceStepTemplateInput[]
}

export type RecurringServiceLifecycleAction = 'pause' | 'resume' | 'end'
