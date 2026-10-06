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

function manualExecutionWhere(
  workspaceId: string,
  workspaceMemberId: string,
): Prisma.JobWhereInput {
  return {
    schedulingEventId: null,
    OR: [
      {
        assignments: {
          some: jobAssignmentEligibilityWhere(workspaceId, workspaceMemberId),
        },
      },
      {
        // Preserve pre-Phase-9A manual Jobs that only have the compatibility
        // assignee. Once normalized assignments exist they are authoritative.
        assignments: { none: {} },
        assigneeMemberId: workspaceMemberId,
      },
    ],
  }
}

async function lockCurrentTeamExecutionMembership(input: {
  tx: Prisma.TransactionClient
  workspaceId: string
  workspaceMemberId: string
  teamIds: string[]
}) {
  if (!input.teamIds.length) return false
  // Fence membership removal for the rest of the execution transaction. The
  // final guarded mutation still rechecks that the matching Team is active.
  const memberships = await input.tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT membership."id"
      FROM "WorkspaceTeamMember" AS membership
      WHERE membership."workspaceId" = ${input.workspaceId}
        AND membership."workspaceMemberId" = ${input.workspaceMemberId}
        AND membership."teamId" IN (${Prisma.join(input.teamIds)})
        AND EXISTS (
          SELECT 1
          FROM "WorkspaceTeam" AS team
          WHERE team."id" = membership."teamId"
            AND team."workspaceId" = ${input.workspaceId}
            AND team."isActive" = TRUE
            AND team."archivedAt" IS NULL
        )
      FOR SHARE OF membership
    `,
  )
  return memberships.length > 0
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
    select: {
      schedulingEventId: true,
      assigneeMemberId: true,
      assignments: {
        select: {
          assignmentType: true,
          workspaceMemberId: true,
          teamId: true,
        },
      },
    },
  })
  if (!reference) return false
  if (!reference.schedulingEventId) {
    if (
      reference.assignments.some(
        (assignment) =>
          assignment.assignmentType === 'MEMBER' &&
          assignment.workspaceMemberId === input.workspaceMemberId &&
          assignment.teamId === null,
      )
    ) {
      return true
    }
    const teamIds = reference.assignments.flatMap((assignment) =>
      assignment.assignmentType === 'TEAM' &&
      assignment.teamId &&
      !assignment.workspaceMemberId
        ? [assignment.teamId]
        : [],
    )
    if (teamIds.length) {
      return lockCurrentTeamExecutionMembership({
        tx: input.tx,
        workspaceId: input.workspaceId,
        workspaceMemberId: input.workspaceMemberId,
        teamIds,
      })
    }
    return (
      reference.assignments.length === 0 &&
      reference.assigneeMemberId === input.workspaceMemberId
    )
  }

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
  return lockCurrentTeamExecutionMembership({
    tx: input.tx,
    workspaceId: input.workspaceId,
    workspaceMemberId: input.workspaceMemberId,
    teamIds,
  })
}

export function jobExecutionEligibilityWhere(input: {
  workspaceId: string
  jobId: string
  workspaceMemberId: string
}): Prisma.JobWhereInput {
  const { workspaceId, jobId, workspaceMemberId } = input
  return {
    id: jobId,
    ...workspaceMemberExecutableJobsWhere({ workspaceId, workspaceMemberId }),
  }
}

export function workspaceMemberExecutableJobsWhere(input: {
  workspaceId: string
  workspaceMemberId: string
}): Prisma.JobWhereInput {
  const { workspaceId, workspaceMemberId } = input
  return {
    workspaceId,
    archivedAt: null,
    OR: [
      manualExecutionWhere(workspaceId, workspaceMemberId),
      recurringExecutionWhere(workspaceId, workspaceMemberId),
    ],
  }
}

export function workspaceMemberReadableWorkItemsWhere(input: {
  workspaceId: string
  workspaceMemberId: string
}): Prisma.WorkItemWhereInput {
  return {
    workspaceId: input.workspaceId,
    archivedAt: null,
    OR: [
      {
        kind: 'TODO',
        assigneeMemberId: input.workspaceMemberId,
      },
      {
        kind: 'JOB_STEP',
        job: { is: workspaceMemberExecutableJobsWhere(input) },
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
      id: { in: input.jobIds },
      ...workspaceMemberExecutableJobsWhere(input),
    },
    select: { id: true },
  })
  return new Set(jobs.map((job) => job.id))
}
