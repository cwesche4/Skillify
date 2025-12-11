import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

import type {
  AutomationStatus,
  RunStatus,
  WorkspaceMemberRole,
} from '@/lib/prisma/enums'

import { AutomationStatus as A, RunStatus as R } from '@/lib/prisma/enums'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') ?? '').trim()

  if (!query) {
    return NextResponse.json([])
  }

  const q = query.toLowerCase()

  // Workspaces
  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // Automations
  const automations = await prisma.automation.findMany({
    where: {
      name: { contains: q, mode: 'insensitive' },
    },
    include: {
      workspace: true,
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
    take: 5,
  })

  // Runs
  const runs = await prisma.automationRun.findMany({
    where: {
      log: query ? { contains: q, mode: 'insensitive' } : undefined,
    },
    include: {
      automation: {
        include: {
          workspace: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 5,
  })

  const members = await prisma.workspaceMember.findMany({
    where: {
      OR: [
        {
          workspace: {
            name: { contains: q, mode: 'insensitive' },
          },
        },
        {
          user: {
            clerkId: { contains: q, mode: 'insensitive' },
          },
        },
      ],
    },
    include: {
      workspace: true,
      user: true,
    },
    take: 5,
  })

  return NextResponse.json([
    ...workspaces.map((w: any) => ({
      type: 'workspace',
      id: w.id,
      name: w.name,
      slug: w.slug,
      createdAt: w.createdAt.toISOString(),
    })),

    ...automations.map((a: any) => ({
      type: 'automation',
      id: a.id,
      name: a.name,
      workspaceId: a.workspaceId,
      workspaceName: a.workspace?.name ?? '',
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      lastRunAt: a.runs[0]?.startedAt
        ? a.runs[0].startedAt.toISOString()
        : null,
    })),

    ...runs.map((r: any) => ({
      type: 'run',
      id: r.id,
      automationId: r.automationId,
      automationName: r.automation?.name ?? '',
      workspaceId: r.workspaceId,
      workspaceName: r.automation?.workspace?.name ?? '',
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      durationMs:
        r.finishedAt && r.startedAt
          ? r.finishedAt.getTime() - r.startedAt.getTime()
          : null,
    })),

    ...members.map((m: any) => ({
      type: 'member',
      id: m.id,
      workspaceId: m.workspaceId,
      workspaceName: m.workspace?.name ?? '',
      userId: m.user?.id ?? '',
      clerkId: m.user?.clerkId ?? '',
      role: m.role,
    })),
  ])
}
