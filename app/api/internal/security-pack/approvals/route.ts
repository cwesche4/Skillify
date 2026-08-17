import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { hasWorkspaceEntitlement } from '@/lib/enterprise/entitlements'

const REVIEWER_ROLES = ['security', 'legal', 'grc']
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  })
  if (
    !profile ||
    !REVIEWER_ROLES.includes((profile.role ?? '').toLowerCase())
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find requests that do NOT have an approval/rejection event
  const decided = await prisma.securityPackAuditEvent.findMany({
    where: { eventType: { in: ['APPROVED', 'REJECTED'] } },
    select: { requestId: true },
  })
  const decidedIds = new Set(decided.map((d) => d.requestId))

  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') || DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  )
  const cursor = url.searchParams.get('cursor')
  let cursorCreatedAt: Date | undefined
  let cursorId: string | undefined
  if (cursor) {
    const [ts, id] = cursor.split('|')
    if (ts && id) {
      cursorCreatedAt = new Date(ts)
      cursorId = id
    }
  }

  const baseWhere: any = {
    approvalRequired: true,
    id: { notIn: Array.from(decidedIds) },
  }
  if (cursorCreatedAt && cursorId) {
    baseWhere.OR = [
      { createdAt: { gt: cursorCreatedAt } },
      { createdAt: cursorCreatedAt, id: { gt: cursorId } },
    ]
  }

  const requests = await prisma.securityPackRequest.findMany({
    where: baseWhere,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // deterministic oldest-first
    take: limit * 2 + 1, // over-fetch to account for entitlement filtering
    select: {
      id: true,
      workspaceId: true,
      industry: true,
      requestedArtifacts: true,
      createdAt: true,
    },
  })

  const pending = requests.filter((r) => !decidedIds.has(r.id))
  if (!pending.length) {
    return NextResponse.json({ items: [] })
  }

  const workspaceIds = Array.from(new Set(pending.map((p) => p.workspaceId)))
  const entitlementResults = await Promise.all(
    workspaceIds.map(async (id) => ({
      id,
      allowed: await hasWorkspaceEntitlement(
        id,
        'SECURITY_PACK_APPROVAL_INBOX',
      ),
    })),
  )
  const allowedWorkspaceIds = new Set(
    entitlementResults.filter((r) => r.allowed).map((r) => r.id),
  )
  const filteredPending = pending.filter((p) =>
    allowedWorkspaceIds.has(p.workspaceId),
  )
  if (!filteredPending.length) {
    return NextResponse.json({ items: [] })
  }

  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: Array.from(allowedWorkspaceIds) } },
    select: { id: true, name: true },
  })
  const workspaceNameMap = new Map(workspaces.map((w) => [w.id, w.name]))

  // Pull NDA-related notes from audit events
  const auditNotes = await prisma.securityPackAuditEvent.findMany({
    where: {
      requestId: { in: filteredPending.map((p) => p.id) },
      decisionNotes: { not: null },
    },
    select: {
      requestId: true,
      decisionNotes: true,
    },
  })

  const ndaStatusByRequest: Record<
    string,
    'confirmed' | 'missing' | 'unknown'
  > = {}
  for (const req of filteredPending) {
    const notes = auditNotes
      .filter((e) => e.requestId === req.id && e.decisionNotes)
      .map((e) => e.decisionNotes!.toLowerCase())
    if (notes.some((n) => n.includes('nda') && n.includes('not confirmed'))) {
      ndaStatusByRequest[req.id] = 'missing'
    } else if (notes.some((n) => n.includes('nda') && n.includes('required'))) {
      ndaStatusByRequest[req.id] = 'missing'
    } else if (
      notes.some((n) => n.includes('nda') && n.includes('confirmed'))
    ) {
      ndaStatusByRequest[req.id] = 'confirmed'
    } else {
      ndaStatusByRequest[req.id] = 'unknown'
    }
  }

  const items = filteredPending.map((r) => ({
    requestId: r.id,
    workspaceId: r.workspaceId,
    workspaceName: workspaceNameMap.get(r.workspaceId) ?? r.workspaceId,
    industry: r.industry,
    requestedArtifacts: r.requestedArtifacts,
    ndaStatus: ndaStatusByRequest[r.id] ?? 'unknown',
    submittedAt: r.createdAt,
  }))

  const limitedItems = items.slice(0, limit)
  const hasMore = items.length > limit
  const nextCursor =
    hasMore && limitedItems.length
      ? `${limitedItems[limitedItems.length - 1].submittedAt.toISOString()}|${
          limitedItems[limitedItems.length - 1].requestId
        }`
      : null

  return NextResponse.json({ items: limitedItems, nextCursor })
}
