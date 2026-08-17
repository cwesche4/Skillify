import { prisma } from '@/lib/db'
import {
  workspaceTeamTypes,
  type WorkspaceTeamSummary,
  type WorkspaceTeamTypeValue,
} from '@/lib/workspaceStructure/types'

export class WorkspaceTeamError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'WorkspaceTeamError'
  }
}

export type WorkspaceStructureActor = {
  workspaceId: string
  actorUserId: string
  canManageWorkspace: boolean
}

export type WorkspaceTeamInput = {
  name?: string | null
  description?: string | null
  teamType?: string | null
  leadMemberId?: string | null
  memberIds?: string[] | null
  isActive?: boolean | null
}

const prismaTeamTypeByValue: Record<WorkspaceTeamTypeValue, string> = {
  general: 'GENERAL',
  office: 'OFFICE',
  fieldCrew: 'FIELD_CREW',
  sales: 'SALES',
  service: 'SERVICE',
  installation: 'INSTALLATION',
  warehouse: 'WAREHOUSE',
  management: 'MANAGEMENT',
  other: 'OTHER',
}

const teamTypeByPrismaValue = Object.fromEntries(
  Object.entries(prismaTeamTypeByValue).map(([key, value]) => [value, key]),
) as Record<string, WorkspaceTeamTypeValue>

function requireManager(actor: WorkspaceStructureActor) {
  if (!actor.canManageWorkspace) {
    throw new WorkspaceTeamError(
      'You do not have permission to manage workspace teams.',
      403,
    )
  }
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function normalizeTeamType(value: string | null | undefined) {
  if (!value) return null
  return workspaceTeamTypes.includes(value as WorkspaceTeamTypeValue)
    ? (value as WorkspaceTeamTypeValue)
    : null
}

function normalizeMemberIds(value: string[] | null | undefined) {
  return Array.from(
    new Set(
      (value ?? [])
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  )
}

function serializeTeam(team: any): WorkspaceTeamSummary {
  return {
    id: team.id,
    workspaceId: team.workspaceId,
    name: team.name,
    description: team.description,
    teamType: team.teamType
      ? teamTypeByPrismaValue[String(team.teamType)]
      : null,
    leadMemberId: team.leadMemberId,
    isActive: Boolean(team.isActive) && !team.archivedAt,
    archivedAt: team.archivedAt
      ? new Date(team.archivedAt).toISOString()
      : null,
    createdAt: new Date(team.createdAt).toISOString(),
    updatedAt: new Date(team.updatedAt).toISOString(),
    members: (team.members ?? []).map((membership: any) => ({
      id: membership.id,
      workspaceMemberId: membership.workspaceMemberId,
      roleLabel: membership.roleLabel,
      isPrimary: Boolean(membership.isPrimary),
      name:
        membership.workspaceMember?.user?.fullName ??
        membership.workspaceMember?.user?.email ??
        'Unnamed member',
      email: membership.workspaceMember?.user?.email,
    })),
  }
}

async function assertMembersBelongToWorkspace({
  workspaceId,
  memberIds,
}: {
  workspaceId: string
  memberIds: string[]
}) {
  if (!memberIds.length) return
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, id: { in: memberIds } },
    select: { id: true },
  })
  const foundIds = new Set(members.map((member) => member.id))
  const missing = memberIds.filter((id) => !foundIds.has(id))
  if (missing.length) {
    throw new WorkspaceTeamError(
      'Choose workspace members for this team.',
      400,
      {
        memberIds:
          'One or more selected members do not belong to this workspace.',
      },
    )
  }
}

async function assertUniqueActiveTeamName({
  workspaceId,
  name,
  exceptTeamId,
}: {
  workspaceId: string
  name: string
  exceptTeamId?: string
}) {
  const existing = await (prisma as any).workspaceTeam.findFirst({
    where: {
      workspaceId,
      name: { equals: name, mode: 'insensitive' },
      archivedAt: null,
      ...(exceptTeamId ? { id: { not: exceptTeamId } } : {}),
    },
    select: { id: true },
  })
  if (existing) {
    throw new WorkspaceTeamError('A team with this name already exists.', 400, {
      name: 'A team with this name already exists.',
    })
  }
}

export async function listWorkspaceTeams({
  workspaceId,
  includeArchived = false,
}: {
  workspaceId: string
  includeArchived?: boolean
}) {
  const teams = await (prisma as any).workspaceTeam.findMany({
    where: {
      workspaceId,
      ...(includeArchived ? {} : { archivedAt: null, isActive: true }),
    },
    include: {
      members: {
        include: { workspaceMember: { include: { user: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
  })
  return teams.map(serializeTeam)
}

export async function createWorkspaceTeam({
  actor,
  input,
}: {
  actor: WorkspaceStructureActor
  input: WorkspaceTeamInput
}) {
  requireManager(actor)
  const name = normalizeName(input.name)
  if (name.length < 2) {
    throw new WorkspaceTeamError('Team name is required.', 400, {
      name: 'Team name is required.',
    })
  }
  const teamType = normalizeTeamType(input.teamType) ?? 'general'
  const memberIds = normalizeMemberIds(input.memberIds)
  const leadMemberId = input.leadMemberId?.trim() || null
  const memberIdsForValidation = leadMemberId
    ? Array.from(new Set([...memberIds, leadMemberId]))
    : memberIds
  await assertMembersBelongToWorkspace({
    workspaceId: actor.workspaceId,
    memberIds: memberIdsForValidation,
  })
  if (leadMemberId && !memberIds.includes(leadMemberId)) {
    memberIds.push(leadMemberId)
  }
  await assertUniqueActiveTeamName({
    workspaceId: actor.workspaceId,
    name,
  })
  const team = await (prisma as any).workspaceTeam.create({
    data: {
      workspaceId: actor.workspaceId,
      name,
      description: input.description?.trim() || null,
      teamType: prismaTeamTypeByValue[teamType],
      leadMemberId,
      isActive: input.isActive ?? true,
      archivedAt: input.isActive === false ? new Date() : null,
      createdById: actor.actorUserId,
      members: {
        create: memberIds.map((workspaceMemberId) => ({
          workspaceId: actor.workspaceId,
          workspaceMemberId,
          isPrimary: workspaceMemberId === leadMemberId,
        })),
      },
    },
    include: {
      members: {
        include: { workspaceMember: { include: { user: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  return serializeTeam(team)
}

export async function updateWorkspaceTeam({
  actor,
  teamId,
  input,
}: {
  actor: WorkspaceStructureActor
  teamId: string
  input: WorkspaceTeamInput
}) {
  requireManager(actor)
  const existing = await (prisma as any).workspaceTeam.findFirst({
    where: { id: teamId, workspaceId: actor.workspaceId },
    select: { id: true },
  })
  if (!existing) throw new WorkspaceTeamError('Team not found.', 404)

  const name = normalizeName(input.name)
  if (name.length < 2) {
    throw new WorkspaceTeamError('Team name is required.', 400, {
      name: 'Team name is required.',
    })
  }
  await assertUniqueActiveTeamName({
    workspaceId: actor.workspaceId,
    name,
    exceptTeamId: teamId,
  })
  const teamType = normalizeTeamType(input.teamType) ?? 'general'
  const memberIds = normalizeMemberIds(input.memberIds)
  const leadMemberId = input.leadMemberId?.trim() || null
  const memberIdsForValidation = leadMemberId
    ? Array.from(new Set([...memberIds, leadMemberId]))
    : memberIds
  await assertMembersBelongToWorkspace({
    workspaceId: actor.workspaceId,
    memberIds: memberIdsForValidation,
  })
  if (leadMemberId && !memberIds.includes(leadMemberId)) {
    memberIds.push(leadMemberId)
  }

  const team = await prisma.$transaction(async (tx) => {
    await (tx as any).workspaceTeamMember.deleteMany({
      where: { teamId, workspaceId: actor.workspaceId },
    })
    return (tx as any).workspaceTeam.update({
      where: { id: teamId },
      data: {
        name,
        description: input.description?.trim() || null,
        teamType: prismaTeamTypeByValue[teamType],
        leadMemberId,
        isActive: input.isActive ?? true,
        archivedAt: input.isActive === false ? new Date() : null,
        members: {
          create: memberIds.map((workspaceMemberId) => ({
            workspaceId: actor.workspaceId,
            workspaceMemberId,
            isPrimary: workspaceMemberId === leadMemberId,
          })),
        },
      },
      include: {
        members: {
          include: { workspaceMember: { include: { user: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  })
  return serializeTeam(team)
}

export async function archiveWorkspaceTeam({
  actor,
  teamId,
}: {
  actor: WorkspaceStructureActor
  teamId: string
}) {
  requireManager(actor)
  const team = await (prisma as any).workspaceTeam.updateMany({
    where: { id: teamId, workspaceId: actor.workspaceId },
    data: { isActive: false, archivedAt: new Date() },
  })
  if (!team.count) throw new WorkspaceTeamError('Team not found.', 404)
}

export async function restoreWorkspaceTeam({
  actor,
  teamId,
}: {
  actor: WorkspaceStructureActor
  teamId: string
}) {
  requireManager(actor)
  const existing = await (prisma as any).workspaceTeam.findFirst({
    where: { id: teamId, workspaceId: actor.workspaceId },
    select: { id: true, name: true },
  })
  if (!existing) throw new WorkspaceTeamError('Team not found.', 404)
  await assertUniqueActiveTeamName({
    workspaceId: actor.workspaceId,
    name: existing.name,
    exceptTeamId: teamId,
  })
  await (prisma as any).workspaceTeam.update({
    where: { id: teamId },
    data: { isActive: true, archivedAt: null },
  })
}
