import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  SecurityPackIndustry,
  SecurityPackReviewType,
  SecurityPackArtifactType,
  SecurityPackEventType,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { hasWorkspaceEntitlement } from '@/lib/enterprise/entitlements'

// Validate incoming payload against Prisma enums
const BodySchema = z
  .object({
    workspaceId: z.string().trim().min(1),
    industry: z.nativeEnum(SecurityPackIndustry),
    reviewType: z.nativeEnum(SecurityPackReviewType),
    requestedArtifacts: z.array(z.nativeEnum(SecurityPackArtifactType)).min(1),
    ndaConfirmed: z.boolean().optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  // 1) Authenticate
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2) Validate request body
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const body = parsed.data

  // Resolve requester profile
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3) Verify workspace membership
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: body.workspaceId, userId: profile.id },
    select: { id: true },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4) Enforce entitlement (Enterprise-level)
  const allowed = await hasWorkspaceEntitlement(
    body.workspaceId,
    'SECURITY_PACK_REQUEST',
  )
  if (!allowed) {
    return NextResponse.json(
      { error: 'Security Pack requests require an Enterprise entitlement.' },
      { status: 403 },
    )
  }

  // 5) Create SecurityPackRequest (no status columns, append-only model)
  const requestRecord = await prisma.securityPackRequest.create({
    data: {
      workspaceId: body.workspaceId,
      requestedByUserId: profile.id,
      industry: body.industry,
      reviewType: body.reviewType,
      requestedArtifacts: body.requestedArtifacts,
      approvalRequired: true,
    },
    select: {
      id: true,
      workspaceId: true,
      industry: true,
      reviewType: true,
      requestedArtifacts: true,
      approvalRequired: true,
      createdAt: true,
    },
  })

  // 6) Append REQUEST_SUBMITTED audit event (append-only)
  await prisma.securityPackAuditEvent.create({
    data: {
      requestId: requestRecord.id,
      workspaceId: body.workspaceId,
      eventType: SecurityPackEventType.REQUEST_SUBMITTED,
      actorUserId: profile.id,
      decisionNotes: body.ndaConfirmed ? 'NDA confirmed' : 'NDA not confirmed',
    },
  })

  // If NDA not confirmed, append validation warning event (append-only)
  if (!body.ndaConfirmed) {
    await prisma.securityPackAuditEvent.create({
      data: {
        requestId: requestRecord.id,
        workspaceId: body.workspaceId,
        eventType: SecurityPackEventType.VALIDATION_FAILED,
        actorUserId: profile.id,
        decisionNotes: 'NDA required for workspace-scoped exports',
      },
    })
  }

  // 7) Return request metadata
  return NextResponse.json(
    {
      id: requestRecord.id,
      workspaceId: requestRecord.workspaceId,
      industry: requestRecord.industry,
      reviewType: requestRecord.reviewType,
      requestedArtifacts: requestRecord.requestedArtifacts,
      approvalRequired: requestRecord.approvalRequired,
      createdAt: requestRecord.createdAt,
    },
    { status: 201 },
  )
}
