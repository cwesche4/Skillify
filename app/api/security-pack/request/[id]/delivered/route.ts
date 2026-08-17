import { NextResponse, type NextRequest } from 'next/server'
import { SecurityPackEventType } from '@prisma/client'

import { prisma } from '@/lib/db'
import { authenticateServiceToken } from '@/lib/auth/serviceToken'

// POST /api/security-pack/request/:id/delivered
// Called by automation (n8n/Skillify) to append a delivery event.
// Idempotent: returns 200 with no new event if already delivered. Automation must not retry after 200.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Validate service token with delivery scope
  const authResult = await authenticateServiceToken(
    req,
    'SECURITY_PACK_DELIVERY',
  )
  if (!authResult.ok) return authResult.response

  const requestId = params.id

  // Look up request for workspace scoping
  const requestRecord = await prisma.securityPackRequest.findUnique({
    where: { id: requestId },
    select: { workspaceId: true },
  })
  if (!requestRecord) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Idempotency: if delivery already recorded, no-op with 200
  const existing = await prisma.securityPackAuditEvent.findFirst({
    where: {
      requestId,
      eventType: SecurityPackEventType.DELIVERY_MARKED,
    },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ ok: true, note: 'Already delivered' })
  }

  // Append DELIVERY_MARKED event (append-only)
  await prisma.securityPackAuditEvent.create({
    data: {
      requestId,
      workspaceId: requestRecord.workspaceId,
      eventType: SecurityPackEventType.DELIVERY_MARKED,
      automationSystem: authResult.system as any,
    },
  })

  return NextResponse.json({ ok: true })
}
