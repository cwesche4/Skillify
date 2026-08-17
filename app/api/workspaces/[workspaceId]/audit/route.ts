import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

const DEFAULT_LIMIT = 50

export async function GET(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = params.workspaceId
  if (!workspaceId)
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId } },
    select: { role: true },
  })
  if (
    !membership ||
    (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT),
  )
  const cursor = url.searchParams.get('cursor') || undefined
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
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
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

  const hasMore = filtered.length > limit
  const items = filtered.slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return NextResponse.json({ ok: true, items, nextCursor })
}
