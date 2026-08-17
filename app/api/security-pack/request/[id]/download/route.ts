import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { hasWorkspaceEntitlement } from '@/lib/enterprise/entitlements'

// GET /api/security-pack/request/:id/download
// Read-only resolver: no payloads, no stored URLs, no audit mutations.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // 1) Authenticate
  const { userId: clerkId } = auth()
  if (!clerkId) {
    // Only unauthenticated callers get 401
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve requester profile
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 }) // conceal existence
  }

  // 2) Fetch request (metadata only)
  const request = await prisma.securityPackRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      workspaceId: true,
      requestedByUserId: true,
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 }) // conceal membership
  }

  // 4) Enforce entitlement (conceal on failure)
  const allowed = await hasWorkspaceEntitlement(
    request.workspaceId,
    'SECURITY_PACK_DOWNLOAD',
  )
  if (!allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 }) // conceal plan state
  }

  // 5) Verify delivery event exists (DELIVERY_MARKED)
  const delivered = await prisma.securityPackAuditEvent.findFirst({
    where: {
      requestId: request.id,
      workspaceId: request.workspaceId,
      eventType: 'DELIVERY_MARKED',
    },
    select: { id: true },
  })
  if (!delivered) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 }) // conceal delivery state
  }

  // 6) Resolve artifact link dynamically (no storage, short-lived/indirect)
  // Placeholder: internal route to generate or proxy a signed URL.
  const redirectUrl = `/api/security-pack/request/${request.id}/artifact`

  return NextResponse.redirect(new URL(redirectUrl, _req.url), 302)
}
