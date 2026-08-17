import { prisma } from '@/lib/db'

export type VersionTag = 'Stable' | 'Live' | 'Draft' | 'Archived' | string

export async function listVersions(automationId: string) {
  const versions = await prisma.automationVersion.findMany({
    where: { automationId },
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
}) {
  // Deactivate current PUBLISHED, activate target. No deletes.
  await prisma.automationVersion.updateMany({
    where: { automationId: params.automationId, status: 'PUBLISHED' },
    data: { status: 'ARCHIVED' },
  })
  return prisma.automationVersion.update({
    where: { id: params.versionId },
    data: { status: 'PUBLISHED' },
  })
}
