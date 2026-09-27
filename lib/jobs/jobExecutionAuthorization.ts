import { Prisma, type PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'

const EXECUTABLE_RECURRING_JOB_STATUSES = [
  'OPEN',
  'SCHEDULED',
  'IN_PROGRESS',
  'WAITING_ON_CLIENT',
] as const

const EXECUTABLE_SCHEDULING_EVENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
] as const

function jobAssignmentEligibilityWhere(
  workspaceId: string,
  workspaceMemberId: string,
): Prisma.JobAssignmentWhereInput {
  return {
    workspaceId,
    OR: [
      {
        assignmentType: 'MEMBER',
        workspaceMemberId,
        teamId: null,
      },
      {
        assignmentType: 'TEAM',
        workspaceMemberId: null,
        team: {
          is: {
            workspaceId,
            isActive: true,
            archivedAt: null,
            members: { some: { workspaceId, workspaceMemberId } },
          },
        },
      },
    ],
  }
}

function recurringExecutionWhere(
  workspaceId: string,
  workspaceMemberId: string,
): Prisma.JobWhereInput {
  return {
    schedulingEventId: { not: null },
    status: { in: [...EXECUTABLE_RECURRING_JOB_STATUSES] },
    assignments: {
      some: jobAssignmentEligibilityWhere(workspaceId, workspaceMemberId),
    },
    // Scheduling terminal state is authoritative even before lifecycle outbox
    // reconciliation updates the Job snapshot.
    schedulingEvent: {
      is: {
        workspaceId,
        deletedAt: null,
        status: { in: [...EXECUTABLE_SCHEDULING_EVENT_STATUSES] },
        occurrenceState: {
          notIn: ['CANCELED', 'COMPLETED', 'DELETED', 'SUPERSEDED'],
        },
      },
    },
  }
}

export async function lockAndValidateRecurringJobExecution(input: {
  tx: Prisma.TransactionClient
  workspaceId: string
  jobId: string
  workspaceMemberId: string
}) {
  const reference = await input.tx.job.findFirst({
    where: {
      id: input.jobId,
      workspaceId: input.workspaceId,
      archivedAt: null,
    },
    select: { schedulingEventId: true },
  })
  if (!reference) return false
  if (!reference.schedulingEventId) return true

  const lockedEvents = await input.tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${reference.schedulingEventId} AND "workspaceId" = ${input.workspaceId} FOR UPDATE`,
  )
  if (lockedEvents.length !== 1) return false
  const event = await input.tx.schedulingEvent.findFirst({
    where: {
      id: reference.schedulingEventId,
      workspaceId: input.workspaceId,
      deletedAt: null,
      status: { in: [...EXECUTABLE_SCHEDULING_EVENT_STATUSES] },
      occurrenceState: { in: ['GENERATED', 'OVERRIDDEN'] },
    },
    include: { assignments: true },
  })
  if (!event) return false
  if (
    event.assignments.some(
      (assignment) =>
        assignment.assignmentType === 'MEMBER' &&
        assignment.workspaceMemberId === input.workspaceMemberId &&
        assignment.teamId === null,
    )
  ) {
    return true
  }
  const teamIds = event.assignments.flatMap((assignment) =>
    assignment.assignmentType === 'TEAM' &&
    assignment.teamId &&
    !assignment.workspaceMemberId
      ? [assignment.teamId]
      : [],
  )
  if (!teamIds.length) return false
  const team = await input.tx.workspaceTeam.findFirst({
    where: {
      id: { in: teamIds },
      workspaceId: input.workspaceId,
      isActive: true,
      archivedAt: null,
      members: {
        some: {
          workspaceId: input.workspaceId,
          workspaceMemberId: input.workspaceMemberId,
        },
      },
    },
    select: { id: true },
  })
  return Boolean(team)
}

export function jobExecutionEligibilityWhere(input: {
  workspaceId: string
  jobId: string
  workspaceMemberId: string
}): Prisma.JobWhereInput {
  const { workspaceId, jobId, workspaceMemberId } = input
  return {
    id: jobId,
    workspaceId,
    archivedAt: null,
    OR: [
      // Legacy/manual Jobs continue to use the original single-assignee field.
      // Recurring Jobs never authorize from this compatibility mirror alone.
      {
        schedulingEventId: null,
        assigneeMemberId: workspaceMemberId,
      },
      {
        ...recurringExecutionWhere(workspaceId, workspaceMemberId),
      },
    ],
  }
}

export async function canWorkspaceMemberExecuteJob(
  input: {
    workspaceId: string
    jobId: string
    workspaceMemberId: string
  },
  db: Pick<PrismaClient, 'job'> = prisma,
) {
  const job = await db.job.findFirst({
    where: jobExecutionEligibilityWhere(input),
    select: { id: true },
  })
  return Boolean(job)
}

export async function listWorkspaceMemberExecutableJobIds(
  input: {
    workspaceId: string
    jobIds: string[]
    workspaceMemberId: string
  },
  db: Pick<PrismaClient, 'job'> = prisma,
) {
  if (!input.jobIds.length) return new Set<string>()
  const jobs = await db.job.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { in: input.jobIds },
      archivedAt: null,
      OR: [
        {
          schedulingEventId: null,
          assigneeMemberId: input.workspaceMemberId,
        },
        {
          ...recurringExecutionWhere(
            input.workspaceId,
            input.workspaceMemberId,
          ),
        },
      ],
    },
    select: { id: true },
  })
  return new Set(jobs.map((job) => job.id))
}
