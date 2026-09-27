import type {
  JobCancellationReason,
  JobStatus,
  JobUnableToCompleteReason,
  OperationsPriority,
  WorkItemKind,
  WorkItemStatus,
} from '@/lib/prisma/enums'

export type JobRecord = {
  id: string
  workspaceId: string
  title: string
  description: string | null
  notes: string | null
  status: JobStatus
  priority: OperationsPriority
  customerReferenceId: string | null
  customerId: string | null
  customerDisplayName: string | null
  valueCents: number | null
  currency: string
  scheduledStartAt: Date | null
  scheduledEndAt: Date | null
  recurringServiceId: string | null
  schedulingEventId: string | null
  serviceInstructionsSnapshot: string | null
  completedAt: Date | null
  cancellationReason: JobCancellationReason | null
  cancellationNote: string | null
  canceledAt: Date | null
  unableToCompleteReason: JobUnableToCompleteReason | null
  unableToCompleteNote: string | null
  unableToCompleteAt: Date | null
  unableToCompleteReportedByMemberId: string | null
  assigneeMemberId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  assignments?: JobAssignmentRecord[]
}

export type JobAssignmentRecord = {
  id: string
  workspaceId: string
  jobId: string
  assignmentType: 'MEMBER' | 'TEAM'
  workspaceMemberId: string | null
  teamId: string | null
  roleLabel: string | null
  displaySnapshot: string | null
  createdAt: Date
  updatedAt: Date
}

export type WorkItemRecord = {
  id: string
  workspaceId: string
  kind: WorkItemKind
  jobId: string | null
  title: string
  description: string | null
  notes: string | null
  status: WorkItemStatus
  priority: OperationsPriority
  dueAt: Date | null
  completedAt: Date | null
  sortOrder: number | null
  assigneeMemberId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type CreateJobData = Omit<
  JobRecord,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'archivedAt'
  | 'cancellationReason'
  | 'cancellationNote'
  | 'canceledAt'
  | 'unableToCompleteReason'
  | 'unableToCompleteNote'
  | 'unableToCompleteAt'
  | 'unableToCompleteReportedByMemberId'
  | 'assignments'
>

export type UpdateJobData = Partial<
  Pick<
    JobRecord,
    | 'title'
    | 'description'
    | 'notes'
    | 'status'
    | 'priority'
    | 'customerReferenceId'
    | 'customerId'
    | 'customerDisplayName'
    | 'valueCents'
    | 'currency'
    | 'scheduledStartAt'
    | 'scheduledEndAt'
    | 'completedAt'
    | 'assigneeMemberId'
    | 'archivedAt'
  >
>

export type UpdateJobResult = {
  job: JobRecord
  completionEventId: string | null
}

export type CreateWorkItemData = Omit<
  WorkItemRecord,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export type UpdateWorkItemData = Partial<
  Pick<
    WorkItemRecord,
    | 'title'
    | 'description'
    | 'notes'
    | 'status'
    | 'priority'
    | 'dueAt'
    | 'completedAt'
    | 'assigneeMemberId'
    | 'archivedAt'
  >
>
