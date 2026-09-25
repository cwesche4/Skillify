import type {
  JobStatus,
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
  completedAt: Date | null
  assigneeMemberId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
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
  assigneeMemberId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type CreateJobData = Omit<
  JobRecord,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
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
