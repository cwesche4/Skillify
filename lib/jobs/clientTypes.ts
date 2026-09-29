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
  serviceLocationSnapshot?: string | null
  customerContactNameSnapshot?: string | null
  customerPhoneSnapshot?: string | null
  customerEmailSnapshot?: string | null
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
  assignments?: JobAssignmentClientRecord[]
  recurringServiceId?: string | null
  schedulingEventId?: string | null
  serviceInstructionsSnapshot?: string | null
  cancellationReason?: string | null
  cancellationNote?: string | null
  canceledAt?: string | null
  unableToCompleteReason?: string | null
  unableToCompleteNote?: string | null
  unableToCompleteAt?: string | null
  unableToCompleteReportedByMemberId?: string | null
  canCurrentMemberExecute?: boolean
}

export type JobAssignmentClientRecord = {
  id: string
  workspaceId: string
  jobId: string
  assignmentType: 'MEMBER' | 'TEAM'
  workspaceMemberId: string | null
  teamId: string | null
  roleLabel: string | null
  displaySnapshot: string | null
  createdAt: string
  updatedAt: string
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
  sortOrder?: number | null
}

export type WorkspaceMemberOption = {
  id: string
  name: string
  role: string
}

export type WorkspaceTeamOption = {
  id: string
  name: string
}

export type JobAssignmentMutation =
  | { assignmentType: 'MEMBER'; workspaceMemberId: string }
  | { assignmentType: 'TEAM'; teamId: string }

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
  assignments?: JobAssignmentMutation[]
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
