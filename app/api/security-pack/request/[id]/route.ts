import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { SecurityPackEventType } from '@prisma/client'
import { hasWorkspaceEntitlement } from '@/lib/enterprise/entitlements'

const EVENT_LABELS: Record<SecurityPackEventType, string> = {
  REQUEST_SUBMITTED: 'Request submitted',
  VALIDATION_FAILED: 'Validation issue',
  APPROVAL_REQUESTED: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  DELIVERY_MARKED: 'Delivered',
  DELIVERY_FAILED: 'Delivery issue',
}

const FOOTNOTE =
  'Events are generated automatically and may be delayed during approval or delivery.'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // 1) Authenticate
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve requester profile
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2) Fetch request metadata (no status columns; immutable)
  const request = await prisma.securityPackRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      workspaceId: true,
      requestedByUserId: true,
      industry: true,
      reviewType: true,
      requestedArtifacts: true,
      createdAt: true,
    },
  })

  if (!request) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 3) Authorization: requester or workspace admin
  const isRequester = request.requestedByUserId === profile.id
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: request.workspaceId, userId: profile.id },
    select: { role: true },
  })
  const isAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER'

  if (!isRequester && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4) Enforce entitlement (view timeline)
  const allowed = await hasWorkspaceEntitlement(
    request.workspaceId,
    'SECURITY_PACK_REQUEST',
  )
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 5) Fetch timeline events (append-only, ordered)
  const events = await prisma.securityPackAuditEvent.findMany({
    where: { requestId: request.id, workspaceId: request.workspaceId },
    orderBy: { createdAt: 'asc' },
    select: {
      eventType: true,
      createdAt: true,
      decisionNotes: true,
    },
  })

  // Map to customer-safe timeline (hide roles/ids/system/correlation)
  const timeline = events.map((e) => ({
    eventType: e.eventType,
    createdAt: e.createdAt,
    label: EVENT_LABELS[e.eventType],
    // Show NDA pending/confirmed only if present in decisionNotes
    note:
      e.decisionNotes &&
      (e.decisionNotes.toLowerCase().includes('nda')
        ? e.decisionNotes
        : undefined),
  }))

  return NextResponse.json({
    request: {
      id: request.id,
      workspaceId: request.workspaceId,
      industry: request.industry,
      reviewType: request.reviewType,
      requestedArtifacts: request.requestedArtifacts,
      createdAt: request.createdAt,
    },
    timeline,
    footnote: FOOTNOTE,
  })
}
