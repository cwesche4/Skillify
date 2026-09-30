import {
  JobStatus,
  OperationsPriority,
  WorkItemStatus,
  type JobStatus as JobStatusValue,
  type OperationsPriority as OperationsPriorityValue,
  type WorkItemStatus as WorkItemStatusValue,
} from '@/lib/prisma/enums'
import type { JobClientRecord } from '@/lib/jobs/clientTypes'

export type JobSavedView =
  | 'all'
  | 'my-jobs'
  | 'open'
  | 'urgent'
  | 'scheduled-today'
  | 'needs-attention'
  | 'waiting'
  | 'completed'

export const jobSavedViews: Array<{
  id: JobSavedView
  label: string
  tone: 'cyan' | 'rose' | 'purple' | 'amber' | 'green' | 'slate'
}> = [
  { id: 'my-jobs', label: 'My Jobs', tone: 'cyan' },
  { id: 'all', label: 'All Jobs', tone: 'slate' },
  { id: 'open', label: 'Open', tone: 'cyan' },
  { id: 'urgent', label: 'Urgent', tone: 'rose' },
  { id: 'scheduled-today', label: 'Scheduled Today', tone: 'purple' },
  { id: 'needs-attention', label: 'Needs Attention', tone: 'rose' },
  { id: 'waiting', label: 'Waiting on Client', tone: 'amber' },
  { id: 'completed', label: 'Completed', tone: 'green' },
]

export const jobStatusLabels: Record<JobStatusValue, string> = {
  OPEN: 'Open',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  WAITING_ON_CLIENT: 'Waiting on Client',
  UNABLE_TO_COMPLETE: 'Unable to Complete',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

export const workItemStatusLabels: Record<WorkItemStatusValue, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

export const priorityLabels: Record<OperationsPriorityValue, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export type JobAssignmentPresentationInput = {
  id: string
  assignmentType: 'MEMBER' | 'TEAM'
  displaySnapshot: string | null
  createdAt: Date | string
  workspaceMember?: {
    user: { fullName: string | null; email: string | null }
  } | null
  team?: { name: string } | null
}

export function getJobAssignmentPresentation(input: {
  assignments: JobAssignmentPresentationInput[]
  assignmentCount: number
  legacyAssigneeLabel?: string | null
}) {
  const ordered = [...input.assignments].sort((first, second) => {
    const createdAt =
      new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
    return createdAt || first.id.localeCompare(second.id)
  })
  const labels: string[] = []
  const seen = new Set<string>()

  for (const assignment of ordered) {
    const fallback =
      assignment.assignmentType === 'MEMBER'
        ? assignment.workspaceMember?.user.fullName ||
          assignment.workspaceMember?.user.email ||
          'Workspace member'
        : assignment.team?.name || 'Assigned team'
    const label = assignment.displaySnapshot?.trim() || fallback
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
    if (labels.length === 3) break
  }

  if (input.assignmentCount === 0) {
    const legacyLabel = input.legacyAssigneeLabel?.trim() || null
    return {
      label: legacyLabel,
      isUnassigned: legacyLabel === null,
    }
  }

  const visibleLabels = labels.slice(0, 3)
  const hiddenCount = Math.max(0, input.assignmentCount - visibleLabels.length)
  return {
    label: [
      ...visibleLabels,
      ...(hiddenCount > 0 ? [`+${hiddenCount}`] : []),
    ].join(' · '),
    isUnassigned: false,
  }
}

export function isOpenJob(job: JobClientRecord) {
  return job.status !== JobStatus.COMPLETED && job.status !== JobStatus.CANCELED
}

export function isScheduledToday(job: JobClientRecord, now = new Date()) {
  if (!job.scheduledStartAt) return false
  const scheduled = new Date(job.scheduledStartAt)
  return (
    scheduled.getFullYear() === now.getFullYear() &&
    scheduled.getMonth() === now.getMonth() &&
    scheduled.getDate() === now.getDate()
  )
}

export function matchesJobSavedView(
  job: JobClientRecord,
  view: JobSavedView,
  now = new Date(),
) {
  switch (view) {
    case 'my-jobs':
      return isOpenJob(job) && job.canCurrentMemberExecute === true
    case 'open':
      return isOpenJob(job)
    case 'urgent':
      return isOpenJob(job) && job.priority === OperationsPriority.URGENT
    case 'scheduled-today':
      return isOpenJob(job) && isScheduledToday(job, now)
    case 'needs-attention':
      return job.status === JobStatus.UNABLE_TO_COMPLETE
    case 'waiting':
      return job.status === JobStatus.WAITING_ON_CLIENT
    case 'completed':
      return job.status === JobStatus.COMPLETED
    case 'all':
      return true
  }
}

export function filterJobs(
  jobs: JobClientRecord[],
  view: JobSavedView,
  search: string,
  now = new Date(),
) {
  const query = search.trim().toLowerCase()
  const priorityRank: Record<OperationsPriorityValue, number> = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
  }
  return jobs
    .filter((job) => !job.archivedAt)
    .filter((job) => matchesJobSavedView(job, view, now))
    .filter((job) =>
      query
        ? [job.title, job.customerDisplayName, job.description, job.notes]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true,
    )
    .sort((first, second) => {
      const priority =
        priorityRank[first.priority] - priorityRank[second.priority]
      if (priority) return priority
      return (
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
      )
    })
}

export function getAllowedJobStatuses(current: JobStatusValue) {
  const transitions: Record<JobStatusValue, JobStatusValue[]> = {
    OPEN: [
      JobStatus.OPEN,
      JobStatus.SCHEDULED,
      JobStatus.IN_PROGRESS,
      JobStatus.WAITING_ON_CLIENT,
      JobStatus.COMPLETED,
      JobStatus.CANCELED,
    ],
    SCHEDULED: [
      JobStatus.SCHEDULED,
      JobStatus.OPEN,
      JobStatus.IN_PROGRESS,
      JobStatus.WAITING_ON_CLIENT,
      JobStatus.COMPLETED,
      JobStatus.CANCELED,
    ],
    IN_PROGRESS: [
      JobStatus.IN_PROGRESS,
      JobStatus.OPEN,
      JobStatus.SCHEDULED,
      JobStatus.WAITING_ON_CLIENT,
      JobStatus.COMPLETED,
      JobStatus.CANCELED,
    ],
    WAITING_ON_CLIENT: [
      JobStatus.WAITING_ON_CLIENT,
      JobStatus.OPEN,
      JobStatus.SCHEDULED,
      JobStatus.IN_PROGRESS,
      JobStatus.COMPLETED,
      JobStatus.CANCELED,
    ],
    UNABLE_TO_COMPLETE: [JobStatus.UNABLE_TO_COMPLETE],
    COMPLETED: [JobStatus.COMPLETED, JobStatus.IN_PROGRESS],
    CANCELED: [JobStatus.CANCELED, JobStatus.OPEN],
  }
  return transitions[current]
}

export function getAllowedWorkItemStatuses(current: WorkItemStatusValue) {
  const transitions: Record<WorkItemStatusValue, WorkItemStatusValue[]> = {
    OPEN: [
      WorkItemStatus.OPEN,
      WorkItemStatus.IN_PROGRESS,
      WorkItemStatus.COMPLETED,
      WorkItemStatus.CANCELED,
    ],
    IN_PROGRESS: [
      WorkItemStatus.IN_PROGRESS,
      WorkItemStatus.OPEN,
      WorkItemStatus.COMPLETED,
      WorkItemStatus.CANCELED,
    ],
    COMPLETED: [WorkItemStatus.COMPLETED, WorkItemStatus.OPEN],
    CANCELED: [WorkItemStatus.CANCELED, WorkItemStatus.OPEN],
  }
  return transitions[current]
}
