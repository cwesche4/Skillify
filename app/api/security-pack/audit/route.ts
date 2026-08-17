import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { resolveDownloadLink } from '@/lib/securityPack/downloadResolver'
import { hasWorkspaceEntitlement } from '@/lib/enterprise/entitlements'

const DEFAULT_SIZE = 25
const MAX_SIZE = 100

export async function GET(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')?.trim()
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 },
    )
  }

  // Resolve profile
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin access
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: profile.id },
    select: { role: true },
  })
  const isAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER'
  if (!isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allowed = await hasWorkspaceEntitlement(
    workspaceId,
    'WORKSPACE_AUDIT_FEED',
  )
  if (!allowed)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Pagination params
  const size = Math.min(
    Math.max(Number(url.searchParams.get('limit') || DEFAULT_SIZE), 1),
    MAX_SIZE,
  )
  const cursorParam = url.searchParams.get('cursor')
  const cursorId = cursorParam?.trim() || undefined

  const auditEvents = await prisma.securityPackAuditEvent.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: size + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    select: {
      id: true,
      requestId: true,
      eventType: true,
      createdAt: true,
    },
  })

  const hasMore = auditEvents.length > size
  const items = auditEvents.slice(0, size)
  const nextCursor = hasMore && items.length ? items[items.length - 1].id : null

  // Resolve downloads per request (only if delivered)
  const downloadCache = new Map<
    string,
    { downloadAvailable: boolean; downloadUrl?: string }
  >()
  const results = []
  for (const ev of items) {
    if (!downloadCache.has(ev.requestId)) {
      downloadCache.set(
        ev.requestId,
        await resolveDownloadLink({
          requestId: ev.requestId,
          workspaceId,
        }),
      )
    }
    results.push({
      id: ev.id,
      requestId: ev.requestId,
      eventType: ev.eventType,
      createdAt: ev.createdAt,
      download: downloadCache.get(ev.requestId),
    })
  }

  return NextResponse.json({
    items: results,
    nextCursor,
  })
}
