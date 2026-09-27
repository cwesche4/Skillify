import type { OperationsPriority } from '@/lib/prisma/enums'
import type {
  SchedulingAssignmentTarget,
  SchedulingRecurrenceRule,
} from '@/lib/scheduling/types'

export type RecurringServiceClientJob = {
  id: string
  title: string
  status: string
  priority: string
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  completedAt: string | null
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
}

export type RecurringServiceClientRecord = {
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
  status: 'ACTIVE' | 'PAUSED' | 'ENDED'
  createdAt: string
  updatedAt: string
  endedAt: string | null
  customer?: { id: string; displayName: string }
  stepTemplates: Array<{
    id: string
    title: string
    description: string | null
    sortOrder: number
  }>
  recurrenceSeries?: {
    id: string
    status: string
    version: number
    timezone: string
    normalizedRule: SchedulingRecurrenceRule | null
    localStartDate: string | null
    localStartTime: string | null
    durationMinutes: number
    masterEvent: {
      id: string
      title: string
      startsAtUtc: string
      endsAtUtc: string
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
  jobs?: RecurringServiceClientJob[]
}

export type RecurringServiceMutation = {
  name: string
  description: string | null
  serviceInstructions: string | null
  pricePerVisitCents: number
  currency: string
  defaultJobPriority: OperationsPriority
  defaultSteps: Array<{ title: string; description: string | null }>
}

export type RecurringServiceScheduleMutation = {
  title: string
  startsAt: string
  endsAt: string
  timezone: string
  assignedMemberIds: string[]
  assignments: SchedulingAssignmentTarget[]
  locationType: 'customerLocation' | 'toBeDetermined'
  locationLabel?: string
  locationAddress?: string
  recurrenceRule: SchedulingRecurrenceRule
  linkedRecord?: {
    recordType: 'customer'
    recordId: string
    label: string
  }
}
