import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@prisma/client'

const MAX_LIMIT = 5000
const DEFAULT_LIMIT = 500

function redactMeta(meta: any) {
  if (!meta || typeof meta !== 'object') return meta ?? null
  const clone: Record<string, any> = { ...meta }
  ;['payload', 'raw', 'body'].forEach((key) => {
    if (key in clone) clone[key] = '[redacted]'
  })
  return clone
}

async function requireOwnerOrAdmin(workspaceId: string) {
  const { userId } = auth()
  if (!userId) throw new Error('UNAUTH')

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: userId } },
    select: { role: true },
  })

  if (
    !membership ||
    (membership.role !== WorkspaceMemberRole.OWNER &&
      membership.role !== WorkspaceMemberRole.ADMIN)
  ) {
    throw new Error('FORBIDDEN')
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const workspaceId = url.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId required' },
        { status: 400 },
      )
    }

    try {
      await requireOwnerOrAdmin(workspaceId)
    } catch (err: any) {
      if (err.message === 'UNAUTH') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (err.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      throw err
    }

    const format = (url.searchParams.get('format') || 'json').toLowerCase()
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT),
    )
    const action = url.searchParams.get('action') || undefined
    const actorId = url.searchParams.get('actorId') || undefined
    const targetType = url.searchParams.get('targetType') || undefined
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const q = (url.searchParams.get('q') || '').toLowerCase().trim()

    const where: any = { workspaceId }
    if (action) where.action = action
    if (actorId) where.actorId = actorId
    if (targetType) where.targetType = targetType
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    })

    const filtered = q
      ? logs.filter((log) => {
          const metaStr = log.meta ? JSON.stringify(log.meta).toLowerCase() : ''
          return (
            log.action.toLowerCase().includes(q) ||
            log.targetType.toLowerCase().includes(q) ||
            metaStr.includes(q)
          )
        })
      : logs

    const items = filtered.map((log) => ({
      id: log.id,
      workspaceId: log.workspaceId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      actorId: log.actorId,
      actor: log.actor,
      createdAt: log.createdAt,
      meta: redactMeta(log.meta),
    }))

    if (format === 'csv') {
      const headers = [
        'id',
        'workspaceId',
        'action',
        'targetType',
        'targetId',
        'actorId',
        'actorFullName',
        'actorEmail',
        'createdAt',
        'meta',
      ]
      const rows = items.map((item) =>
        [
          item.id,
          item.workspaceId,
          item.action,
          item.targetType,
          item.targetId ?? '',
          item.actorId ?? '',
          item.actor?.fullName ?? '',
          item.actor?.email ?? '',
          item.createdAt.toISOString(),
          JSON.stringify(item.meta ?? {}),
        ]
          .map((field) => {
            const str = String(field ?? '')
            // basic CSV escaping
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          })
          .join(','),
      )
      const csv = [headers.join(','), ...rows].join('\n')
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="audit-export.csv"',
        },
      })
    }

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    console.error('Audit export failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
