import { prisma } from '@/lib/db'
import { AUTOMATION_MANAGEMENT_ROLES } from '@/lib/automations/policy'

export type VersionTag = 'Stable' | 'Live' | 'Draft' | 'Archived' | string

export async function listVersions(params: {
  automationId: string
  workspaceId: string
  viewerUserId: string
}) {
  const versions = await prisma.automationVersion.findMany({
    where: {
      automationId: params.automationId,
      workspaceId: params.workspaceId,
      automation: {
        workspace: { members: { some: { userId: params.viewerUserId } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      automationId: true,
      createdAt: true,
      createdByUserId: true,
      label: true,
      message: true,
      status: true,
      snapshots: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      },
    },
  })

  return versions.map((v) => ({
    id: v.id,
    automationId: v.automationId,
    createdAt: v.createdAt,
    createdById: v.createdByUserId,
    tag: v.label ?? undefined,
    note: v.message ?? undefined,
    isActive: v.status === 'PUBLISHED',
    snapshotId: v.snapshots[0]?.id,
  }))
}

export async function createVersion(params: {
  automationId: string
  workspaceId: string
  createdByUserId: string
  flow: any
  tag?: VersionTag
  note?: string
}) {
  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: params.workspaceId,
      simpleAutomationInstallation: null,
      workspace: {
        members: {
          some: {
            userId: params.createdByUserId,
            role: { in: [...AUTOMATION_MANAGEMENT_ROLES] },
          },
        },
      },
    },
    select: { id: true },
  })
  if (!automation) throw new Error('Automation not found')

  // Immutable version + snapshot; never overwrite
  const version = await prisma.automationVersion.create({
    data: {
      automationId: params.automationId,
      workspaceId: params.workspaceId,
      createdByUserId: params.createdByUserId,
      label: params.tag ?? 'Draft',
      message: params.note ?? '',
      status: 'DRAFT',
    },
  })

  await prisma.automationVersionSnapshot.create({
    data: {
      versionId: version.id,
      flowJson: params.flow,
      nodeCount: Array.isArray(params.flow?.nodes)
        ? params.flow.nodes.length
        : 0,
      edgeCount: Array.isArray(params.flow?.edges)
        ? params.flow.edges.length
        : 0,
      checksum: '', // placeholder; checksum not computed here
    },
  })

  return version
}

export async function activateVersion(params: {
  automationId: string
  versionId: string
  workspaceId: string
  actorUserId: string
}) {
  const version = await prisma.automationVersion.findFirst({
    where: {
      id: params.versionId,
      automationId: params.automationId,
      workspaceId: params.workspaceId,
      automation: {
        simpleAutomationInstallation: null,
        workspace: {
          members: {
            some: {
              userId: params.actorUserId,
              role: { in: [...AUTOMATION_MANAGEMENT_ROLES] },
            },
          },
        },
      },
    },
    select: { id: true },
  })
  if (!version) throw new Error('Version not found')

  return prisma.$transaction(async (tx) => {
    await tx.automationVersion.updateMany({
      where: {
        automationId: params.automationId,
        workspaceId: params.workspaceId,
        status: 'PUBLISHED',
      },
      data: { status: 'ARCHIVED' },
    })
    return tx.automationVersion.update({
      where: { id: version.id },
      data: { status: 'PUBLISHED' },
    })
  })
}
