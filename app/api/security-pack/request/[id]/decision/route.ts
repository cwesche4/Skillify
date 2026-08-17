import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { SecurityPackApproverRole, SecurityPackEventType } from '@prisma/client'

const BodySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  role: z.nativeEnum(SecurityPackApproverRole),
  notes: z.string().max(500).optional(),
})

const REVIEWER_ROLES = ['security', 'legal', 'grc']

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

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

  const request = await prisma.securityPackRequest.findUnique({
    where: { id: params.id },
    select: { id: true, workspaceId: true, requestedByUserId: true },
  })
  if (!request) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Prevent self-approval to maintain separation of duties
  if (request.requestedByUserId === profile.id) {
    return NextResponse.json(
      { error: 'Requester cannot approve this request' },
      { status: 403 },
    )
  }

  const eventType =
    body.data.decision === 'APPROVED'
      ? SecurityPackEventType.APPROVED
      : SecurityPackEventType.REJECTED

  await prisma.securityPackAuditEvent.create({
    data: {
      requestId: request.id,
      workspaceId: request.workspaceId,
      eventType,
      actorUserId: profile.id,
      actorRole: body.data.role,
      decisionNotes: body.data.notes,
    },
  })

  return NextResponse.json({
    ok: true,
    // SLA-neutral acknowledgment; audit event is the source of truth
  })
}
