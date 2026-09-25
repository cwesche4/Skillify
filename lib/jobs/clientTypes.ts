import type {
  JobStatus,
  OperationsPriority,
  WorkItemKind,
  WorkItemStatus,
} from '@/lib/prisma/enums'

export type JobClientRecord = {
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
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  completedAt: string | null
  assigneeMemberId: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type WorkItemClientRecord = {
  id: string
  workspaceId: string
  kind: WorkItemKind
  jobId: string | null
  title: string
  description: string | null
  notes: string | null
  status: WorkItemStatus
  priority: OperationsPriority
  dueAt: string | null
  completedAt: string | null
  assigneeMemberId: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type WorkspaceMemberOption = {
  id: string
  name: string
  role: string
}

export type JobMutationInput = {
  title?: string
  description?: string | null
  notes?: string | null
  status?: JobStatus
  priority?: OperationsPriority
  customerReferenceId?: string | null
  customerId?: string | null
  customerDisplayName?: string | null
  valueCents?: number | null
  currency?: string
  scheduledStartAt?: string | null
  scheduledEndAt?: string | null
  assigneeMemberId?: string | null
}

export type JobStepMutationInput = {
  title?: string
  description?: string | null
  notes?: string | null
  status?: WorkItemStatus
  priority?: OperationsPriority
  dueAt?: string | null
  assigneeMemberId?: string | null
}
